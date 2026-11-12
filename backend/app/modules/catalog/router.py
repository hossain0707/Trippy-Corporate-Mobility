"""Public verified route/vehicle catalog and exact physical seat availability."""
from datetime import date
from uuid import UUID
from fastapi import APIRouter,Query
from ...core.database import connection,one,rows
from ...core.errors import fail
from ..booking.pricing import end_date,MONTHLY
from ..booking.corridors import segment_orders

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
    """Find any valid ordered morning/return stop pair on an approved corridor.

    This is NOT an origin/destination route-name search: Abdullahpur ->
    Motijheel also serves Uttara -> Banani when both are approved stops.
    """
    if vehicleClass not in (None,'bus','hiace','car'):
        fail(422,'Unsupported vehicle class')
    if pickup and len(pickup)>100 or office and len(office)>100:
        fail(422,'Search locations must be under 100 characters')
    pickup=pickup.strip() if pickup and pickup.strip() else None
    office=office.strip() if office and office.strip() else None
    with connection() as conn:
        return rows(conn,'''SELECT s.id,s.code,s.morning_departure::text,s.evening_departure::text,
            r.name AS route_name,r.home_zone,r.office_zone,
            v.class AS vehicle_class,v.licensed_passenger_capacity,
            selected_pair.pickup_stop_id,selected_pair.dropoff_stop_id,
            selected_pair.pickup_stop_name,selected_pair.dropoff_stop_name,
            (SELECT COUNT(*)::int FROM app.vehicle_seats vs
              WHERE vs.vehicle_id=v.id AND vs.enabled) AS selectable_seats
          FROM app.services s
          JOIN app.routes r ON r.id=s.route_id
          JOIN app.vehicles v ON v.id=s.vehicle_id
          JOIN LATERAL (
            SELECT mp.stop_id AS pickup_stop_id,md.stop_id AS dropoff_stop_id,
              p.name AS pickup_stop_name,z.name AS dropoff_stop_name
            FROM app.route_stops mp
            JOIN app.stops p ON p.id=mp.stop_id AND p.approved AND p.active
            JOIN app.route_stops md ON md.route_id=mp.route_id
              AND md.direction='morning' AND md.stop_order>mp.stop_order
            JOIN app.stops z ON z.id=md.stop_id AND z.approved AND z.active
            JOIN app.route_stops ep ON ep.route_id=mp.route_id
              AND ep.direction='evening' AND ep.stop_id=mp.stop_id
            JOIN app.route_stops ed ON ed.route_id=mp.route_id
              AND ed.direction='evening' AND ed.stop_id=md.stop_id
              AND ed.stop_order<ep.stop_order
            WHERE mp.route_id=s.route_id AND mp.direction='morning'
              AND (%s::text IS NULL OR p.name ILIKE '%%'||%s||'%%'
                   OR p.zone ILIKE '%%'||%s||'%%')
              AND (%s::text IS NULL OR z.name ILIKE '%%'||%s||'%%'
                   OR z.zone ILIKE '%%'||%s||'%%')
            ORDER BY mp.stop_order,md.stop_order DESC LIMIT 1
          ) selected_pair ON TRUE
          WHERE s.active AND r.active AND v.active
            AND v.documents_verified AND v.seat_map_verified
            AND v.fitness_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date)
            AND v.insurance_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date)
            AND (%s::text IS NULL OR v.class=%s)
          ORDER BY s.morning_departure,s.code LIMIT 100''',
          (pickup,pickup,pickup,office,office,office,vehicleClass,vehicleClass))

def details(conn,service_id):
    service=one(conn,'''SELECT s.id,s.code,s.route_id,s.vehicle_id,s.morning_departure::text,s.evening_departure::text,s.operating_days,
          r.name AS route_name,r.home_zone,r.office_zone,v.class AS vehicle_class,v.licensed_passenger_capacity,v.fitness_expires_on,v.insurance_expires_on
          FROM app.services s JOIN app.routes r ON r.id=s.route_id JOIN app.vehicles v ON v.id=s.vehicle_id
          WHERE s.id=%s AND s.active AND r.active AND v.active AND v.documents_verified AND v.seat_map_verified
          AND v.fitness_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date) AND v.insurance_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date)''',(service_id,))
    if not service: fail(404,'Service currently unavailable')
    service['stops']=rows(conn,'''SELECT rs.direction,rs.stop_order,t.id,t.name,t.zone,t.latitude,t.longitude,
              tm.planned_arrival::text AS planned_arrival
          FROM app.route_stops rs
          JOIN app.stops t ON t.id=rs.stop_id
          LEFT JOIN app.service_stop_times tm ON tm.service_id=%s
            AND tm.direction=rs.direction AND tm.stop_id=rs.stop_id
          WHERE rs.route_id=%s AND t.approved AND t.active
          ORDER BY rs.direction,rs.stop_order''',(service['id'],service['route_id']))
    return service

@router.get('/services/{service_id}')
def service_details(service_id:UUID):
    with connection() as conn:
        return details(conn,service_id)

@router.get('/services/{service_id}/seats')
def seat_availability(service_id:UUID,startDate:date,
                      months:int=Query(1,ge=1,le=12),
                      pickupStopId:UUID|None=None,dropoffStopId:UUID|None=None):
    """Check occupancy on the exact requested corridor legs, in BOTH directions.

    Without stops, conservatively treat the whole recurring route as occupied
    when any segment is booked. This protects older API clients from displaying
    a falsely available seat before the traveler chooses boarding stops.
    """
    try: ends=end_date(startDate,months)
    except ValueError as exc: fail(422,str(exc))
    if (pickupStopId is None)!=(dropoffStopId is None):
        fail(422,'Select both your pickup and drop-off stops')
    with connection() as conn:
        s=details(conn,service_id)
        if min(s['fitness_expires_on'],s['insurance_expires_on']) < ends:
            fail(409,'Vehicle documentation does not cover this subscription period')
        params=[service_id,startDate,ends]
        filter_sql=''
        if pickupStopId is not None:
            mp,md,ed,ep=segment_orders(conn,s['route_id'],pickupStopId,dropoffStopId)
            filter_sql=""" AND (b.morning_segment && int4range(%s,%s,'[)')
                         OR b.evening_segment && int4range(%s,%s,'[)'))"""
            params.extend([mp,md,ed,ep])
        params.append(s['vehicle_id'])
        seats=rows(conn,'''SELECT vs.id,vs.label,vs.row_no,vs.col_no,
            EXISTS (SELECT 1 FROM app.reservations b
              WHERE b.service_id=%s AND b.seat_id=vs.id
                AND daterange(b.starts_on,b.ends_before,'[)') &&
                  daterange(%s,%s,'[)')
                AND (b.status IN ('confirmed','payment_review')
                  OR (b.status='held' AND b.hold_expires_at>now()))'''
            +filter_sql+''') AS occupied
            FROM app.vehicle_seats vs
            WHERE vs.vehicle_id=%s AND vs.enabled
            ORDER BY vs.row_no,vs.col_no''',tuple(params))
    return {'service':s,'startsOn':startDate,'endsBefore':ends,'seats':seats,
            'pickupStopId':pickupStopId,'dropoffStopId':dropoffStopId,
            'availableCount':sum(not x['occupied'] for x in seats)}
