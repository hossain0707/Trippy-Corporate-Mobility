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
                conn.execute('''INSERT INTO app.reservations(user_id,service_id,seat_id,pickup_stop_id,dropoff_stop_id,
                   starts_on,ends_before,months,base_amount_bdt,discount_percent,amount_bdt,hold_expires_at,idempotency_key)
                   VALUES(%s,%s,%s,%s,%s,%s,%s,1,8000,0,8000,now()+interval '10 minutes',%s)''',
                   (user,service,seat,pickup,drop,start,end,uuid4()))
            return True
        except ExclusionViolation:
            return False
    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes=list(executor.map(try_booking,users))
    assert outcomes.count(True)==1 and outcomes.count(False)==1
