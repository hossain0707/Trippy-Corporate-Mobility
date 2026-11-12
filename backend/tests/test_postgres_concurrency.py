"""Run ONLY with disposable TEST_DATABASE_URL after migrations; expects PostgreSQL."""
import os
from datetime import date,timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4
import pytest

@pytest.mark.integration
def test_two_riders_cannot_buy_same_physical_seat():
    url=os.getenv('TEST_DATABASE_URL','')
    if not url: pytest.skip('Set TEST_DATABASE_URL for PostgreSQL concurrency testing')
    if 'test' not in url.lower(): pytest.fail('Test DB URL must name an isolated test database')
    from psycopg import connect
    from psycopg.errors import ExclusionViolation
    with connect(url) as conn:
        with conn.cursor() as cur:
            users=[]
            for _ in range(2):
                cur.execute('INSERT INTO app.users(auth_user_id) VALUES(%s) RETURNING id',(uuid4(),))
                users.append(cur.fetchone()[0])
            cur.execute("INSERT INTO app.stops(name,zone,approved) VALUES('Dev Pickup','Dev',true) RETURNING id")
            pickup=cur.fetchone()[0]
            cur.execute("INSERT INTO app.stops(name,zone,approved) VALUES('Dev Office','Office',true) RETURNING id")
            drop=cur.fetchone()[0]
            cur.execute("INSERT INTO app.routes(name,home_zone,office_zone,active) VALUES('TEST','Dev','Office',true) RETURNING id")
            route=cur.fetchone()[0]
            cur.execute("INSERT INTO app.vehicles(class,registration_no,operator_name,licensed_passenger_capacity) VALUES('car',%s,'TEST',1) RETURNING id",(str(uuid4()),))
            vehicle=cur.fetchone()[0]
            cur.execute("INSERT INTO app.vehicle_seats(vehicle_id,label,row_no,col_no) VALUES(%s,'C1',0,3) RETURNING id",(vehicle,))
            seat=cur.fetchone()[0]
            cur.execute("INSERT INTO app.services(code,route_id,vehicle_id,morning_departure,evening_departure) VALUES(%s,%s,%s,'08:00','18:00') RETURNING id",('TEST-'+uuid4().hex[:8],route,vehicle))
            service=cur.fetchone()[0]
    start=date.today()+timedelta(days=1);end=start+timedelta(days=30)
    barrier=Barrier(2)
    def try_booking(user):
        try:
            with connect(url) as conn:
                barrier.wait(timeout=6)
                # Follow the booking API lock order to serialize rival seat holds.
                conn.execute('SELECT id FROM app.services WHERE id=%s FOR UPDATE',(service,))
                conn.execute('''INSERT INTO app.reservations(user_id,service_id,seat_id,pickup_stop_id,dropoff_stop_id,
                   starts_on,ends_before,months,base_amount_bdt,discount_percent,amount_bdt,hold_expires_at,idempotency_key,
                   morning_segment,evening_segment)
                   VALUES(%s,%s,%s,%s,%s,%s,%s,1,8000,0,8000,now()+interval '10 minutes',%s,
                     int4range(0,1,'[)'),int4range(0,1,'[)'))''',
                   (user,service,seat,pickup,drop,start,end,uuid4()))
            return True
        except ExclusionViolation:
            return False
    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes=list(executor.map(try_booking,users))
    assert outcomes.count(True)==1 and outcomes.count(False)==1


@pytest.mark.integration
def test_same_seat_reused_on_adjacent_nonoverlapping_corridor_legs():
    """Two riders can use the same seat for different legs of the same
    recurring commute; both morning and reverse return legs must be disjoint.
    """
    url=os.getenv('TEST_DATABASE_URL','')
    if not url: pytest.skip('Set TEST_DATABASE_URL')
    if 'test' not in url.lower(): pytest.fail('Use disposable test database only')
    from psycopg import connect
    from psycopg.errors import ExclusionViolation
    start=date.today()+timedelta(days=2)
    end=start+timedelta(days=31)
    with connect(url) as conn:
        with conn.cursor() as cur:
            ids=[]
            for _ in range(3):
                cur.execute('INSERT INTO app.users(auth_user_id) VALUES(%s) RETURNING id',(uuid4(),))
                ids.append(cur.fetchone()[0])
            stops=[]
            for i in range(3):
                cur.execute('INSERT INTO app.stops(name,zone,approved) VALUES(%s,%s,true) RETURNING id',
                    ('LEG-'+str(i),'TEST'))
                stops.append(cur.fetchone()[0])
            cur.execute("""INSERT INTO app.routes(name,home_zone,office_zone,active)
               VALUES('TEST SEGMENT','START','END',true) RETURNING id""")
            route=cur.fetchone()[0]
            cur.execute("""INSERT INTO app.vehicles
              (class,registration_no,operator_name,licensed_passenger_capacity)
              VALUES('bus',%s,'TEST',1) RETURNING id""",(uuid4().hex,))
            vehicle=cur.fetchone()[0]
            cur.execute("""INSERT INTO app.vehicle_seats(vehicle_id,label,row_no,col_no)
              VALUES(%s,'A1',0,0) RETURNING id""",(vehicle,))
            seat=cur.fetchone()[0]
            cur.execute("""INSERT INTO app.services
              (code,route_id,vehicle_id,morning_departure,evening_departure)
              VALUES(%s,%s,%s,'07:30','18:00') RETURNING id""",
              ('SG-'+uuid4().hex[:8],route,vehicle))
            service=cur.fetchone()[0]
            def reserve(user,pick,drop,mp,md,ed,ep):
                cur.execute("""INSERT INTO app.reservations
                  (user_id,service_id,seat_id,pickup_stop_id,dropoff_stop_id,
                    starts_on,ends_before,months,base_amount_bdt,
                    discount_percent,amount_bdt,hold_expires_at,idempotency_key,
                    morning_segment,evening_segment)
                  VALUES(%s,%s,%s,%s,%s,%s,%s,1,5000,0,5000,
                    now()+interval '10 minutes',%s,
                    int4range(%s,%s,'[)'),int4range(%s,%s,'[)'))
                  RETURNING id""",
                  (user,service,seat,pick,drop,start,end,uuid4(),mp,md,ed,ep))
                return cur.fetchone()[0]
            # A->B in the morning, B->A on evening return
            assert reserve(ids[0],stops[0],stops[1],0,1,1,2)
            # B->C morning, C->B evening, both disjoint from previous rider
            assert reserve(ids[1],stops[1],stops[2],1,2,0,1)
            with pytest.raises(ExclusionViolation):
                with conn.transaction():
                    reserve(ids[2],stops[0],stops[2],0,2,0,2)


@pytest.mark.integration
def test_different_seat_occupancy_conflicts_if_evening_legs_overlap():
    """An evening conflict must be blocked even when morning segments differ."""
    url=os.getenv('TEST_DATABASE_URL','')
    if not url: pytest.skip('Set TEST_DATABASE_URL')
    if 'test' not in url.lower(): pytest.fail('Use disposable test database only')
    from psycopg import connect
    from psycopg.errors import ExclusionViolation
    with connect(url) as conn:
        with conn.cursor() as cur:
            users=[]
            for _ in range(2):
                cur.execute('INSERT INTO app.users(auth_user_id) VALUES(%s) RETURNING id',(uuid4(),))
                users.append(cur.fetchone()[0])
            cur.execute("""INSERT INTO app.stops(name,zone,approved)
               VALUES('Test Stop A','TEST',true) RETURNING id""")
            a=cur.fetchone()[0]
            cur.execute("""INSERT INTO app.stops(name,zone,approved)
               VALUES('Test Stop B','TEST',true) RETURNING id""")
            b=cur.fetchone()[0]
            cur.execute("""INSERT INTO app.routes(name,home_zone,office_zone,active)
               VALUES('Test Route','A','B',true) RETURNING id""")
            route=cur.fetchone()[0]
            cur.execute("""INSERT INTO app.vehicles
               (class,registration_no,operator_name,licensed_passenger_capacity)
               VALUES('bus',%s,'TEST',1) RETURNING id""",(uuid4().hex,))
            vehicle=cur.fetchone()[0]
            cur.execute("""INSERT INTO app.vehicle_seats(vehicle_id,label,row_no,col_no)
               VALUES(%s,'A1',0,0) RETURNING id""",(vehicle,))
            seat=cur.fetchone()[0]
            cur.execute("""INSERT INTO app.services
               (code,route_id,vehicle_id,morning_departure,evening_departure)
               VALUES(%s,%s,%s,'07:30','18:00') RETURNING id""",
               ('SE-'+uuid4().hex[:8],route,vehicle))
            service=cur.fetchone()[0]
            start=date.today()+timedelta(days=2)
            end=start+timedelta(days=31)
            common=[service,seat,a,b,start,end]
            cur.execute("""INSERT INTO app.reservations
              (user_id,service_id,seat_id,pickup_stop_id,dropoff_stop_id,
               starts_on,ends_before,months,base_amount_bdt,discount_percent,amount_bdt,
               hold_expires_at,idempotency_key,morning_segment,evening_segment)
              VALUES(%s,%s,%s,%s,%s,%s,%s,1,5000,0,5000,now()+interval '10 minutes',%s,
               int4range(0,1,'[)'),int4range(0,2,'[)'))""",
              (users[0],*common,uuid4()))
            with pytest.raises(ExclusionViolation):
                with conn.transaction():
                    cur.execute("""INSERT INTO app.reservations
                      (user_id,service_id,seat_id,pickup_stop_id,dropoff_stop_id,
                       starts_on,ends_before,months,base_amount_bdt,discount_percent,amount_bdt,
                       hold_expires_at,idempotency_key,morning_segment,evening_segment)
                      VALUES(%s,%s,%s,%s,%s,%s,%s,1,5000,0,5000,now()+interval '10 minutes',%s,
                       int4range(1,2,'[)'),int4range(1,2,'[)'))""",
                      (users[1],*common,uuid4()))
