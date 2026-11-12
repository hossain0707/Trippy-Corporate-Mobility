"""Public verified route/vehicle catalog and exact physical seat availability."""
from datetime import date
from uuid import UUID
from fastapi import APIRouter,Query
from ...core.database import connection,one,rows
from ...core.errors import fail
from ..booking.pricing import end_date,MONTHLY

router=APIRouter(prefix='/api',tags=['Route catalog'])


@router.get('/locations/stops')
def public_approved_stops(q: str = Query(min_length=2, max_length=80)):
    """Public, *approved* stop names for autocomplete; never exposes draft stops."""
    term = q.strip()
    if len(term)<2:
        return []
    with connection() as conn:
        return rows(conn, """SELECT id, name, zone, latitude, longitude
            FROM app.stops
            WHERE approved AND active
              AND (name ILIKE '%%' || %s || '%%' OR zone ILIKE '%%' || %s || '%%')
            ORDER BY
              CASE WHEN lower(name) LIKE lower(%s) || '%%' THEN 0 ELSE 1 END,
              name ASC
            LIMIT 8""", (term,term,term))

@router.get('/pricing')
def pricing():
    return {'currency':'BDT','monthly':MONTHLY,'discounts':{'firstMonth':20,'threeMonths':25,'sixMonths':30,'twelveMonths':35},'stackable':False}

@router.get('/services')
def services(pickup:str|None=None,office:str|None=None,vehicleClass:str|None=None):
    if vehicleClass not in (None,'bus','hiace','car'): fail(422,'Unsupported vehicle class')
    with connection() as conn:
        return rows(conn,'''SELECT s.id,s.code,s.morning_departure::text,s.evening_departure::text,
          r.name AS route_name,r.home_zone,r.office_zone,v.class AS vehicle_class,v.licensed_passenger_capacity,
          (SELECT COUNT(*)::int FROM app.vehicle_seats vs WHERE vs.vehicle_id=v.id AND vs.enabled) AS selectable_seats
          FROM app.services s JOIN app.routes r ON r.id=s.route_id JOIN app.vehicles v ON v.id=s.vehicle_id
          WHERE s.active AND r.active AND v.active AND v.documents_verified AND v.seat_map_verified
          AND v.fitness_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date) AND v.insurance_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date)
          AND (%s::text IS NULL OR r.home_zone ILIKE '%%'||%s||'%%')
          AND (%s::text IS NULL OR r.office_zone ILIKE '%%'||%s||'%%')
          AND (%s::text IS NULL OR v.class=%s)
          ORDER BY s.morning_departure,s.code LIMIT 100''',(pickup,pickup,office,office,vehicleClass,vehicleClass))

def details(conn,service_id):
    service=one(conn,'''SELECT s.id,s.code,s.route_id,s.vehicle_id,s.morning_departure::text,s.evening_departure::text,s.operating_days,
          r.name AS route_name,r.home_zone,r.office_zone,v.class AS vehicle_class,v.licensed_passenger_capacity,v.fitness_expires_on,v.insurance_expires_on
          FROM app.services s JOIN app.routes r ON r.id=s.route_id JOIN app.vehicles v ON v.id=s.vehicle_id
          WHERE s.id=%s AND s.active AND r.active AND v.active AND v.documents_verified AND v.seat_map_verified
          AND v.fitness_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date) AND v.insurance_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date)''',(service_id,))
    if not service: fail(404,'Service currently unavailable')
    service['stops']=rows(conn,'''SELECT rs.direction,rs.stop_order,t.id,t.name,t.zone,t.latitude,t.longitude
          FROM app.route_stops rs JOIN app.stops t ON t.id=rs.stop_id
          WHERE rs.route_id=%s AND t.approved AND t.active ORDER BY rs.direction,rs.stop_order''',(service['route_id'],))
    return service

@router.get('/services/{service_id}')
def service_details(service_id:UUID):
    with connection() as conn:
        return details(conn,service_id)

@router.get('/services/{service_id}/seats')
def seat_availability(service_id:UUID,startDate:date,months:int=Query(1,ge=1,le=12)):
    try: ends=end_date(startDate,months)
    except ValueError as exc: fail(422,str(exc))
    with connection() as conn:
        s=details(conn,service_id)
        if min(s['fitness_expires_on'],s['insurance_expires_on']) < ends:
            fail(409,'Vehicle documentation does not cover this subscription period')
        seats=rows(conn,'''SELECT vs.id,vs.label,vs.row_no,vs.col_no,
            EXISTS (SELECT 1 FROM app.reservations b WHERE b.service_id=%s AND b.seat_id=vs.id
             AND daterange(b.starts_on,b.ends_before,'[)') && daterange(%s,%s,'[)')
             AND (b.status IN ('confirmed','payment_review') OR (b.status='held' AND b.hold_expires_at>now()))) AS occupied
            FROM app.vehicle_seats vs WHERE vs.vehicle_id=%s AND vs.enabled ORDER BY vs.row_no,vs.col_no''',
            (service_id,startDate,ends,s['vehicle_id']))
    return {'service':s,'startsOn':startDate,'endsBefore':ends,'seats':seats,'availableCount':sum(not x['occupied'] for x in seats)}
