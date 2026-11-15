"""Staff-only audited fleet, corridors, schedules, identity assignments and capacity requests."""
from uuid import UUID
from fastapi import APIRouter,Depends
from ...core.database import connection,one,rows,execute
from ...core.schemas import NewStop,NewVehicle,VerifyVehicle,NewRoute,NewService,Activation,DriverAssignment,RoleChange,DriverCompliance,SeatLayout
from ...core.errors import fail
from ...core.clock import today
from ..auth.router import require

router=APIRouter(prefix='/api/admin',tags=['Operations'])

def audit(conn,actor,action,target,detail='{}'):
    execute(conn,'INSERT INTO app.audit_events(actor_id,action,target_id,detail) VALUES(%s,%s,%s,%s::jsonb)',(actor,action,target,detail))

@router.get('/overview')
def overview(user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return {
          'activeVehicles':one(conn,'SELECT COUNT(*)::int AS n FROM app.vehicles WHERE active')['n'],
          'openRequests':one(conn,"SELECT COUNT(*)::int AS n FROM app.demand_requests WHERE status='open'")['n'],
          'confirmedSubscriptions':one(conn,"SELECT COUNT(*)::int AS n FROM app.reservations WHERE status='confirmed'")['n']}

@router.get('/demand')
def demand_list(user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return rows(conn,'SELECT * FROM app.demand_requests ORDER BY created_at DESC LIMIT 200')

@router.get('/stops')
def stops(user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return rows(conn,'SELECT id,name,zone,latitude,longitude,approved,active FROM app.stops ORDER BY zone,name LIMIT 500')

@router.post('/stops',status_code=201)
def add_stop(d:NewStop,user=Depends(require('admin'))):
    with connection() as conn:
        result=one(conn,'''INSERT INTO app.stops(name,zone,latitude,longitude,approved) VALUES(%s,%s,%s,%s,%s) RETURNING *''',
            (d.name,d.zone,d.latitude,d.longitude,d.approved))
        audit(conn,user['id'],'stop.created',result['id'])
        return result

@router.get('/vehicles')
def vehicles(user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return rows(conn,'''SELECT v.id,v.class,v.registration_no,v.operator_name,v.licensed_passenger_capacity,
           v.documents_verified,v.seat_map_verified,v.active,v.fitness_expires_on,v.insurance_expires_on,
           (SELECT COUNT(*)::int FROM app.vehicle_seats WHERE vehicle_id=v.id AND enabled) AS mapped_seats
           FROM app.vehicles v ORDER BY v.created_at DESC LIMIT 200''')

@router.post('/vehicles',status_code=201)
def add_vehicle(d:NewVehicle,user=Depends(require('admin'))):
    if len(d.seats)!=d.licensedPassengerCapacity:
        fail(422,'Passenger seat map must match licensed passenger capacity')
    if len({s.label for s in d.seats})!=len(d.seats) or len({(s.rowNo,s.colNo) for s in d.seats})!=len(d.seats):
        fail(422,'Seat IDs and cabin positions must be unique')
    if d.vehicleClass=='car' and len(d.seats)>4: fail(422,'Car template exceeds supported seat layout')
    with connection() as conn:
        vehicle=one(conn,'''INSERT INTO app.vehicles(class,registration_no,operator_name,licensed_passenger_capacity,fitness_expires_on,insurance_expires_on)
           VALUES(%s,%s,%s,%s,%s,%s) RETURNING *''',
           (d.vehicleClass,d.registrationNo,d.operatorName,d.licensedPassengerCapacity,d.fitnessExpiresOn,d.insuranceExpiresOn))
        for s in d.seats:
            execute(conn,'INSERT INTO app.vehicle_seats(vehicle_id,label,row_no,col_no) VALUES(%s,%s,%s,%s)',
                (vehicle['id'],s.label,s.rowNo,s.colNo))
        audit(conn,user['id'],'vehicle.created',vehicle['id'])
        return vehicle

@router.patch('/vehicles/{vehicle_id}/verify')
def verify_vehicle(vehicle_id:UUID,d:VerifyVehicle,user=Depends(require('admin'))):
    with connection() as conn:
        vehicle=one(conn,'SELECT * FROM app.vehicles WHERE id=%s FOR UPDATE',(vehicle_id,))
        if not vehicle: fail(404,'Vehicle not found')
        mapped=one(conn,'SELECT COUNT(*)::int AS n FROM app.vehicle_seats WHERE vehicle_id=%s AND enabled',(vehicle_id,))['n']
        if mapped!=vehicle['licensed_passenger_capacity']: fail(422,'Seat map and certified passenger capacity differ')
        fitness=d.fitnessExpiresOn or vehicle['fitness_expires_on']
        insurance=d.insuranceExpiresOn or vehicle['insurance_expires_on']
        if d.active and (not d.documentsVerified or not d.seatMapVerified or
                         not fitness or not insurance or fitness<today() or insurance<today()):
            fail(422,'Activation requires inspection, approved seat map, current fitness and insurance dates')
        verified=one(conn,'''UPDATE app.vehicles SET documents_verified=%s,seat_map_verified=%s,active=%s,
            fitness_expires_on=%s,insurance_expires_on=%s WHERE id=%s RETURNING *''',
            (d.documentsVerified,d.seatMapVerified,d.active,fitness,insurance,vehicle_id))
        audit(conn,user['id'],'vehicle.verified',vehicle_id)
        return verified

@router.get('/routes')
def routes(user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return rows(conn,'SELECT id,name,home_zone,office_zone,active FROM app.routes ORDER BY created_at DESC LIMIT 200')

@router.post('/routes',status_code=201)
def add_route(d:NewRoute,user=Depends(require('admin','dispatcher'))):
    if d.homeZone.strip().lower()==d.officeZone.strip().lower(): fail(422,'Home and work zones must differ')
    for seq in (d.morningStops,d.eveningStops):
        if len(seq)!=len(set(seq)): fail(422,'Duplicate route stop')
    if d.eveningStops!=list(reversed(d.morningStops)):
        fail(422,'A return route must run through the same stops in reverse order')
    with connection() as conn:
        refs=list(set(d.morningStops+d.eveningStops))
        approved=rows(conn,'SELECT id FROM app.stops WHERE id=ANY(%s::uuid[]) AND approved AND active',(refs,))
        if len(approved)!=len(refs): fail(422,'Only approved active stops can be scheduled')
        route=one(conn,'INSERT INTO app.routes(name,home_zone,office_zone,active) VALUES(%s,%s,%s,true) RETURNING *',
            (d.name,d.homeZone,d.officeZone))
        for direction,sequence in (('morning',d.morningStops),('evening',d.eveningStops)):
            for index,stop_id in enumerate(sequence):
                execute(conn,'INSERT INTO app.route_stops(route_id,stop_id,direction,stop_order) VALUES(%s,%s,%s,%s)',
                    (route['id'],stop_id,direction,index))
        audit(conn,user['id'],'route.created',route['id'])
        return route

@router.get('/services')
def admin_services(user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return rows(conn,'''SELECT id,code,route_id,vehicle_id,morning_departure::text,evening_departure::text,active
           FROM app.services ORDER BY created_at DESC LIMIT 200''')

@router.post('/services',status_code=201)
def add_service(d:NewService,user=Depends(require('admin','dispatcher'))):
    if len(set(d.operatingDays))!=len(d.operatingDays) or any(not 1<=day<=7 for day in d.operatingDays):
        fail(422,'Invalid ISO weekdays')
    if d.morningDeparture>=d.eveningDeparture: fail(422,'Morning departure must precede evening return')
    with connection() as conn:
        # New services always start inactive until verification and a driver assignment.
        result=one(conn,'''INSERT INTO app.services(code,route_id,vehicle_id,morning_departure,evening_departure,operating_days)
           VALUES(%s,%s,%s,%s,%s,%s) RETURNING *''',
           (d.code,d.routeId,d.vehicleId,d.morningDeparture,d.eveningDeparture,d.operatingDays))
        audit(conn,user['id'],'service.created',result['id'])
        return result

@router.post('/driver-assignments',status_code=201)
def assign_driver(d:DriverAssignment,user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        if not one(conn,"""SELECT 1 FROM app.users u JOIN app.driver_compliance c ON c.driver_id=u.id
            WHERE u.id=%s AND u.role='driver' AND c.license_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date)""",(d.driverId,)):
            fail(422,'Verified driver role and current driving-license approval are required')
        assignment=one(conn,'''INSERT INTO app.driver_assignments(service_id,driver_id) VALUES(%s,%s)
          ON CONFLICT(service_id,driver_id) DO UPDATE SET active=true RETURNING *''',(d.serviceId,d.driverId))
        audit(conn,user['id'],'driver.assigned',d.serviceId)
        return assignment

@router.patch('/services/{service_id}/activate')
def activate(service_id:UUID,d:Activation,user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        service=one(conn,'''SELECT s.*,v.active AS vehicle_active,v.documents_verified,v.seat_map_verified,
          v.licensed_passenger_capacity,v.fitness_expires_on,v.insurance_expires_on,r.active AS route_active
          FROM app.services s JOIN app.vehicles v ON v.id=s.vehicle_id
          JOIN app.routes r ON r.id=s.route_id WHERE s.id=%s FOR UPDATE OF s''',(service_id,))
        if not service: fail(404,'Service not found')
        if d.active:
            if not all([service['vehicle_active'],service['documents_verified'],service['seat_map_verified'],service['route_active']]):
                fail(422,'Vehicle documents, seat map and route must be verified')
            if not service['fitness_expires_on'] or not service['insurance_expires_on'] or service['fitness_expires_on']<today() or service['insurance_expires_on']<today():
                fail(422,'Expired or missing vehicle compliance documents')
            n=one(conn,'SELECT COUNT(*)::int AS n FROM app.vehicle_seats WHERE vehicle_id=%s AND enabled',(service['vehicle_id'],))['n']
            if n!=service['licensed_passenger_capacity']: fail(422,'Invalid physical cabin map')
            for direction in ('morning','evening'):
                count=one(conn,'''SELECT COUNT(*)::int AS n FROM app.route_stops rs JOIN app.stops t ON t.id=rs.stop_id
                    WHERE rs.route_id=%s AND rs.direction=%s AND t.approved AND t.active''',(service['route_id'],direction))['n']
                if count<2: fail(422,'Route needs at least two approved stops in each direction')
                timed=one(conn,'''SELECT COUNT(*)::int AS n
                    FROM app.service_stop_times tm
                    JOIN app.route_stops rs ON rs.route_id=service['route_id']
                      AND rs.direction=tm.direction AND rs.stop_id=tm.stop_id
                    WHERE tm.service_id=%s AND tm.direction=%s''',(service_id,direction))['n']
                if timed!=count:
                    fail(422,'Complete and verify all '+direction+' timetable stops before activation')
            if not one(conn,"""SELECT 1 FROM app.driver_assignments a JOIN app.driver_compliance c ON c.driver_id=a.driver_id
                   WHERE a.service_id=%s AND a.active AND c.license_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date) LIMIT 1""",(service_id,)):
                fail(422,'Assign a verified driver before activating')
        updated=one(conn,'UPDATE app.services SET active=%s WHERE id=%s RETURNING id,code,active',(d.active,service_id))
        audit(conn,user['id'],'service.activation',service_id)
        return updated

@router.patch('/users/{user_id}/role')
def change_role(user_id:UUID,d:RoleChange,user=Depends(require('admin'))):
    if user_id==user['id']: fail(403,'Administrators may not change their own role here')
    with connection() as conn:
        updated=one(conn,'UPDATE app.users SET role=%s WHERE id=%s RETURNING id,role',(d.role,user_id))
        if not updated: fail(404,'User not found')
        audit(conn,user['id'],'staff.role_changed',user_id)
        return updated


@router.post('/drivers/{driver_id}/verify')
def verify_driver(driver_id:UUID,d:DriverCompliance,user=Depends(require('admin'))):
    if d.licenseExpiresOn<today(): fail(422,'Driving license has expired')
    with connection() as conn:
        if not one(conn,"SELECT 1 FROM app.users WHERE id=%s AND role='driver'",(driver_id,)):
            fail(422,'Assign the verified account a driver role first')
        approval=one(conn,'''INSERT INTO app.driver_compliance(driver_id,license_reference,license_expires_on,approved_by)
           VALUES(%s,%s,%s,%s) ON CONFLICT(driver_id) DO UPDATE SET
           license_reference=EXCLUDED.license_reference,license_expires_on=EXCLUDED.license_expires_on,
           approved_by=EXCLUDED.approved_by,approved_at=now() RETURNING driver_id,license_expires_on,approved_at''',
           (driver_id,d.licenseReference,d.licenseExpiresOn,user['id']))
        audit(conn,user['id'],'driver.compliance_verified',driver_id)
        return approval

@router.get('/vehicles/{vehicle_id}/seats')
def seat_map(vehicle_id:UUID,user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return rows(conn,'''SELECT id,label,row_no AS "rowNo",col_no AS "colNo",enabled
          FROM app.vehicle_seats WHERE vehicle_id=%s ORDER BY row_no,col_no''',(vehicle_id,))

@router.put('/vehicles/{vehicle_id}/seats')
def replace_seat_map(vehicle_id:UUID,d:SeatLayout,user=Depends(require('admin'))):
    if len({s.label for s in d.seats})!=len(d.seats) or len({(s.rowNo,s.colNo) for s in d.seats})!=len(d.seats):
        fail(422,'Duplicate seat label or cabin coordinate')
    with connection() as conn:
        vehicle=one(conn,'SELECT * FROM app.vehicles WHERE id=%s FOR UPDATE',(vehicle_id,))
        if not vehicle: fail(404,'Vehicle not found')
        if vehicle['active'] or vehicle['seat_map_verified']:
            fail(409,'Only inactive, unverified vehicles may be edited')
        if len(d.seats)!=vehicle['licensed_passenger_capacity']:
            fail(422,'Passenger layout must exactly match licensed capacity')
        exists=one(conn,'''SELECT 1 FROM app.reservations b JOIN app.services s ON s.id=b.service_id
            WHERE s.vehicle_id=%s LIMIT 1''',(vehicle_id,))
        if exists: fail(409,'Seat map cannot change after reservations exist; perform an audited vehicle migration instead')
        execute(conn,'DELETE FROM app.vehicle_seats WHERE vehicle_id=%s',(vehicle_id,))
        for seat in d.seats:
            execute(conn,'INSERT INTO app.vehicle_seats(vehicle_id,label,row_no,col_no) VALUES(%s,%s,%s,%s)',
                (vehicle_id,seat.label,seat.rowNo,seat.colNo))
        audit(conn,user['id'],'vehicle.seat_map_replaced',vehicle_id)
        return {'vehicleId':vehicle_id,'passengerSeats':len(d.seats),'verified':False}

@router.get('/payments/review')
def review_queue(user=Depends(require('admin'))):
    with connection() as conn:
        return rows(conn,'''SELECT p.id,p.merchant_tran_id,p.amount_bdt,p.status,p.created_at,
          b.id AS reservation_id,b.status AS reservation_status,b.user_id,s.code
          FROM app.payment_attempts p JOIN app.reservations b ON b.id=p.reservation_id
          JOIN app.services s ON s.id=b.service_id
          WHERE p.status IN ('review','created') ORDER BY p.created_at DESC LIMIT 200''')
