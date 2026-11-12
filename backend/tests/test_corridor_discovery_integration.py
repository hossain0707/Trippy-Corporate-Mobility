"""End-to-end PostgreSQL integration of corridor search and segment seat holds.

Only executes on isolated TEST_DATABASE_URL containing 'test'. Never on PRD.
"""
import os
from contextlib import contextmanager
from datetime import date,timedelta
from uuid import uuid4
import pytest

@pytest.mark.integration
def test_intermediate_corridor_discovery_and_seat_reuse(monkeypatch):
    url=os.getenv('TEST_DATABASE_URL','')
    if not url: pytest.skip('Requires disposable PostgreSQL test database')
    if 'test' not in url.lower(): pytest.fail('Refuse non-test DB connection')
    from psycopg import connect
    from psycopg.rows import dict_row
    from psycopg.errors import ExclusionViolation
    from app.modules.catalog import router as catalog
    from app.modules.booking import router as booking
    from app.core.schemas import HoldRequest

    with connect(url,row_factory=dict_row) as conn:
        users=[]
        for _ in range(3):
            users.append(conn.execute('''INSERT INTO app.users(auth_user_id)
              VALUES(%s) RETURNING id''',(uuid4(),)).fetchone()['id'])
        names=['Abdullahpur','Uttara Sector 7','Banani','Motijheel']
        stop_ids=[]
        for name in names:
            stop_ids.append(conn.execute('''INSERT INTO app.stops
              (name,zone,approved,active) VALUES(%s,%s,TRUE,TRUE) RETURNING id''',
              (name,'Uttara' if name.startswith('Uttara') else name)).fetchone()['id'])
        route=conn.execute('''INSERT INTO app.routes
          (name,home_zone,office_zone,active) VALUES
          ('Abdullahpur to Motijheel','Abdullahpur','Motijheel',true)
          RETURNING id''').fetchone()['id']
        for direction,stops in [('morning',stop_ids),('evening',list(reversed(stop_ids)))]:
            for order,stop_id in enumerate(stops):
                conn.execute('''INSERT INTO app.route_stops(route_id,stop_id,direction,stop_order)
                  VALUES(%s,%s,%s,%s)''',(route,stop_id,direction,order))
        vehicle=conn.execute('''INSERT INTO app.vehicles
          (class,registration_no,operator_name,licensed_passenger_capacity,
           documents_verified,seat_map_verified,active,
           fitness_expires_on,insurance_expires_on)
          VALUES('bus',%s,'TEST OPERATOR',1,TRUE,TRUE,TRUE,%s,%s)
          RETURNING id''',(str(uuid4()),date.today()+timedelta(days=720),
                            date.today()+timedelta(days=720))).fetchone()['id']
        seat=conn.execute('''INSERT INTO app.vehicle_seats
          (vehicle_id,label,row_no,col_no) VALUES(%s,'A1',0,0)
          RETURNING id''',(vehicle,)).fetchone()['id']
        service=conn.execute('''INSERT INTO app.services
          (code,route_id,vehicle_id,morning_departure,evening_departure,active)
          VALUES(%s,%s,%s,'07:30','18:00',TRUE) RETURNING id''',
          ('TEST-'+uuid4().hex[:10],route,vehicle)).fetchone()['id']
        for direction,stops,times in [
          ('morning',stop_ids,['07:30','07:45','08:00','08:30']),
          ('evening',list(reversed(stop_ids)),['18:00','18:30','18:50','19:10']),
        ]:
            for stop_id,at in zip(stops,times):
                conn.execute('''INSERT INTO app.service_stop_times
                  (service_id,direction,stop_id,planned_arrival)
                  VALUES(%s,%s,%s,%s)''',(service,direction,stop_id,at))

    @contextmanager
    def test_connection():
        with connect(url,row_factory=dict_row) as c:
            yield c
    monkeypatch.setattr(catalog,'connection',test_connection)
    results=catalog.services(pickup='Uttara',office='Banani')
    match=next(s for s in results if s['id']==service)
    assert match['route_name']=='Abdullahpur to Motijheel'
    assert match['pickup_stop_id']==stop_ids[1]
    assert match['dropoff_stop_id']==stop_ids[2]
    assert match['morning_board_time'].startswith('07:45')
    assert match['evening_board_time'].startswith('18:30')
    assert not any(r['id']==service for r in
      catalog.services(pickup='Motijheel',office='Abdullahpur'))
    assert not any(r['id']==service for r in
      catalog.services(pickup='Uttara',office='Somewhere Outside Corridor'))

    start=date.today()+timedelta(days=2)
    kwargs={'serviceId':service,'seatId':seat,'startDate':start,
            'months':1,'idempotencyKey':uuid4()}
    first=HoldRequest(**kwargs,pickupStopId=stop_ids[1],dropoffStopId=stop_ids[2])
    with test_connection() as conn:
        a=booking.create_hold(conn,users[0],first)
        assert a['morning_segment'].lower==1
        assert a['morning_segment'].upper==2
    adjacent=catalog.seat_availability(service,startDate=start,months=1,
               pickupStopId=stop_ids[2],dropoffStopId=stop_ids[3])
    assert adjacent['availableCount']==1
    with test_connection() as conn:
        second=HoldRequest(**{**kwargs,'idempotencyKey':uuid4()},
            pickupStopId=stop_ids[2],dropoffStopId=stop_ids[3])
        b=booking.create_hold(conn,users[1],second)
        assert b['evening_segment'].lower==0
        assert b['evening_segment'].upper==1
    overlapping=catalog.seat_availability(service,startDate=start,months=1,
                  pickupStopId=stop_ids[0],dropoffStopId=stop_ids[3])
    assert overlapping['availableCount']==0
    with test_connection() as conn:
        full=HoldRequest(**{**kwargs,'idempotencyKey':uuid4()},
            pickupStopId=stop_ids[0],dropoffStopId=stop_ids[3])
        with pytest.raises(ExclusionViolation):
            with conn.transaction():
                booking.create_hold(conn,users[2],full)
