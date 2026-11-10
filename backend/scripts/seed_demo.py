"""Optional, explicitly requested FALSE local data; NEVER for production/staging."""
import os
from uuid import uuid4
from datetime import timedelta
from app.core.database import open_pool,close_pool,connection,one,execute
from app.core.config import settings
from app.core.clock import today

def seat_positions(kind,n):
    pos=[]
    for i in range(n):
        if kind=='bus': row,col=i//4+1, i%4 + (1 if i%4>=2 else 0)
        elif kind=='hiace': row,col=i//3+1, (0 if i%3==0 else i%3+1)
        else: row,col=[(0,3),(1,0),(1,3)][i]
        pos.append((f'{kind[0].upper()}{i+1:02d}',row,col))
    return pos

def main():
    if settings().app_env!='development' or os.getenv('ALLOW_FAKE_RIDES')!='YES_I_UNDERSTAND':
        raise SystemExit('Refusing fake fleet insert outside explicit development opt-in')
    open_pool()
    try:
        with connection() as conn:
            if one(conn,"SELECT 1 FROM app.services WHERE code='DEMO-BUS-001'"):
                print('Demo fleet already exists');return
            driver=one(conn,'''INSERT INTO app.users(auth_user_id,full_name,role) VALUES(%s,'LOCAL DEMO ONLY','driver') RETURNING id''',(uuid4(),))['id']
            execute(conn,'''INSERT INTO app.driver_compliance(driver_id,license_reference,license_expires_on,approved_by)
               VALUES(%s,'FAKE-DEMO-LICENCE',%s,%s)''',(driver,today()+timedelta(days=800),driver))
            routes=[
                ('bus','DEMO-BUS-001','Uttara','Gulshan','07:15','18:00',28,[
                    ('Uttara Sector 7','Uttara',23.8723,90.3981),('Airport Road','Airport',23.8423,90.4042),
                    ('Banani 11','Banani',23.7905,90.4025),('Gulshan 2','Gulshan',23.7936,90.4144)]),
                ('hiace','DEMO-HIACE-001','Mirpur 10','Banani','07:45','18:15',12,[
                    ('Mirpur 10','Mirpur',23.8067,90.3680),('Agargaon','Agargaon',23.7788,90.3809),('Banani','Banani',23.7905,90.4025)]),
                ('car','DEMO-CAR-001','Dhanmondi','Motijheel','08:00','17:45',3,[
                    ('Dhanmondi 27','Dhanmondi',23.7476,90.3740),('Shahbag','Shahbag',23.7384,90.3960),('Motijheel','Motijheel',23.7313,90.4170)])]
            for kind,code,home,office,am,pm,capacity,stops in routes:
                stop_ids=[]
                for name,zone,lat,lon in stops:
                    sid=one(conn,'''INSERT INTO app.stops(name,zone,latitude,longitude,approved,active)
                      VALUES(%s,%s,%s,%s,true,true) RETURNING id''',(name,zone,lat,lon))['id'];stop_ids.append(sid)
                route=one(conn,'''INSERT INTO app.routes(name,home_zone,office_zone,active)
                  VALUES(%s,%s,%s,true) RETURNING id''',(f'DEMO {home} to {office}',home,office))['id']
                for direction,ids in (('morning',stop_ids),('evening',list(reversed(stop_ids)))):
                    for index,sid in enumerate(ids):
                        execute(conn,'INSERT INTO app.route_stops(route_id,stop_id,direction,stop_order) VALUES(%s,%s,%s,%s)',
                            (route,sid,direction,index))
                vehicle=one(conn,'''INSERT INTO app.vehicles(class,registration_no,operator_name,licensed_passenger_capacity,
                  documents_verified,seat_map_verified,active,fitness_expires_on,insurance_expires_on)
                  VALUES(%s,%s,'FAKE DEMO OPERATOR',%s,true,true,true,%s,%s) RETURNING id''',
                  (kind,'FAKE-'+code,capacity,today()+timedelta(days=800),today()+timedelta(days=800)))['id']
                for label,row,col in seat_positions(kind,capacity):
                    execute(conn,'INSERT INTO app.vehicle_seats(vehicle_id,label,row_no,col_no) VALUES(%s,%s,%s,%s)',
                        (vehicle,label,row,col))
                service=one(conn,'''INSERT INTO app.services(code,route_id,vehicle_id,morning_departure,evening_departure,operating_days,active)
                  VALUES(%s,%s,%s,%s,%s,%s,true) RETURNING id''',
                    (code,route,vehicle,am,pm,[7,1,2,3,4]))['id']
                execute(conn,'INSERT INTO app.driver_assignments(service_id,driver_id) VALUES(%s,%s)',(service,driver))
                print('Created fictional local route:',code)
    finally:close_pool()
if __name__=='__main__':main()
