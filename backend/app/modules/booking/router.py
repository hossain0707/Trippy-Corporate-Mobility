"""Transactional holds, bookings, demand. PostgreSQL is the sole authority for inventory."""
from uuid import UUID
from datetime import datetime,timezone
from fastapi import APIRouter,Depends
from psycopg.errors import ExclusionViolation,UniqueViolation,ForeignKeyViolation
from ...core.database import connection,one,rows,execute
from ...core.errors import fail
from ...core.limits import throttle
from ...core.schemas import HoldRequest,DemandRequest
from ..auth.router import actor
from .pricing import quote,end_date

router=APIRouter(prefix='/api',tags=['Reservations'])

def create_hold(conn,user_id,d:HoldRequest):
    try: ends=end_date(d.startDate,d.months)
    except ValueError as exc: fail(422,str(exc))
    service=one(conn,'''SELECT s.id,s.route_id,s.vehicle_id,v.class,v.fitness_expires_on,v.insurance_expires_on FROM app.services s
      JOIN app.vehicles v ON v.id=s.vehicle_id JOIN app.routes r ON r.id=s.route_id
      WHERE s.id=%s AND s.active AND r.active AND v.active AND v.documents_verified AND v.seat_map_verified
      AND v.fitness_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date) AND v.insurance_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date)
      FOR UPDATE OF s''',(d.serviceId,))
    if service is None: fail(404,'Service not currently bookable')
    if min(service['fitness_expires_on'],service['insurance_expires_on']) < ends:
        fail(409,'Vehicle compliance documents must cover the full subscription period')
    user=one(conn,'SELECT id,welcome_redeemed_at FROM app.users WHERE id=%s FOR UPDATE',(user_id,))
    previous=one(conn,'SELECT * FROM app.reservations WHERE user_id=%s AND idempotency_key=%s',(user_id,d.idempotencyKey))
    if previous:
        if previous['status']=='held' and previous['hold_expires_at']>datetime.now(timezone.utc): return previous
        fail(409,'Booking request already processed')
    execute(conn,"UPDATE app.reservations SET status='expired' WHERE (service_id=%s OR user_id=%s) AND status='held' AND hold_expires_at<=now()",(d.serviceId,user_id))
    if not one(conn,'SELECT 1 FROM app.vehicle_seats WHERE id=%s AND vehicle_id=%s AND enabled',(d.seatId,service['vehicle_id'])):
        fail(422,'Seat is not a bookable seat of this vehicle')
    stops=rows(conn,'''SELECT rs.direction,rs.stop_id,rs.stop_order FROM app.route_stops rs
      JOIN app.stops t ON t.id=rs.stop_id WHERE rs.route_id=%s AND rs.stop_id=ANY(%s::uuid[]) AND t.approved AND t.active''',
      (service['route_id'],[d.pickupStopId,d.dropoffStopId]))
    order={(x['direction'],x['stop_id']):x['stop_order'] for x in stops}
    p,z=d.pickupStopId,d.dropoffStopId
    if (('morning',p) not in order or ('morning',z) not in order or
       ('evening',p) not in order or ('evening',z) not in order or
       order['morning',p]>=order['morning',z] or order['evening',z]>=order['evening',p]):
        fail(422,'Stops are not approved in correct morning/evening order')
    first=not user['welcome_redeemed_at'] and not one(conn,"SELECT 1 FROM app.reservations WHERE user_id=%s AND status='confirmed' LIMIT 1",(user_id,))
    fare=quote(service['class'],d.months,first)
    return one(conn,'''INSERT INTO app.reservations
        (user_id,service_id,seat_id,pickup_stop_id,dropoff_stop_id,starts_on,ends_before,months,
         base_amount_bdt,discount_percent,amount_bdt,applies_welcome_offer,hold_expires_at,idempotency_key)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now()+interval '10 minutes',%s) RETURNING *''',
        (user_id,d.serviceId,d.seatId,p,z,d.startDate,ends,d.months,fare.base,fare.discount,fare.amount,fare.welcome,d.idempotencyKey))

@router.post('/reservations/hold',status_code=201)
def hold(data:HoldRequest,user=Depends(actor)):
    throttle('seat-holds',user['id'],15,60)
    try:
        with connection() as conn:
            value=create_hold(conn,user['id'],data)
        return {'id':value['id'],'serviceId':value['service_id'],'seatId':value['seat_id'],
            'startsOn':value['starts_on'],'endsBefore':value['ends_before'],'months':value['months'],
            'status':value['status'],'holdExpiresAt':value['hold_expires_at'],
            'baseAmountBdt':value['base_amount_bdt'],'discountPercent':value['discount_percent'],'amountBdt':value['amount_bdt']}
    except (ExclusionViolation,UniqueViolation):
        fail(409,'Seat unavailable or overlapping subscription')
    except ForeignKeyViolation:
        fail(422,'Invalid referenced stop, seat or service')

@router.get('/me/reservations')
def my_reservations(user=Depends(actor)):
    with connection() as conn:
        return rows(conn,'''SELECT b.id,b.starts_on::text,b.ends_before::text,b.months,b.amount_bdt,b.discount_percent,b.status,b.hold_expires_at,
          b.confirmed_at,b.service_id,v.class AS vehicle_class,s.code,vs.label AS seat_label,
          a.name AS pickup_stop,z.name AS dropoff_stop,s.morning_departure::text,s.evening_departure::text
          FROM app.reservations b JOIN app.services s ON s.id=b.service_id JOIN app.vehicles v ON v.id=s.vehicle_id
          JOIN app.vehicle_seats vs ON vs.id=b.seat_id JOIN app.stops a ON a.id=b.pickup_stop_id
          JOIN app.stops z ON z.id=b.dropoff_stop_id WHERE b.user_id=%s ORDER BY b.created_at DESC LIMIT 100''',(user['id'],))

@router.post('/demand',status_code=201)
def demand(data:DemandRequest,user=Depends(actor)):
    throttle('seat-demand',user['id'],6,3600)
    if data.homeZone.strip().lower()==data.officeZone.strip().lower(): fail(422,'Home and office must differ')
    with connection() as conn:
        return one(conn,'''INSERT INTO app.demand_requests(user_id,service_id,home_zone,office_zone,preferred_class)
          VALUES(%s,%s,%s,%s,%s) RETURNING id,status,created_at''',
          (user['id'],data.serviceId,data.homeZone.strip(),data.officeZone.strip(),data.vehicleClass))

@router.post('/reservations/{reservation_id}/release')
def release_hold(reservation_id:UUID,user=Depends(actor)):
    """Release an unpaid, unprocessed seat hold; never release a payment in flight."""
    throttle('release-seat',user['id'],15,60)
    with connection() as conn:
        booking=one(conn,'SELECT id,status FROM app.reservations WHERE id=%s AND user_id=%s FOR UPDATE',
                   (reservation_id,user['id']))
        if not booking: fail(404,'Reservation not found')
        if booking['status']!='held': fail(409,'Only unpaid held reservations can be released')
        payment=one(conn,'SELECT 1 FROM app.payment_attempts WHERE reservation_id=%s LIMIT 1',(reservation_id,))
        if payment: fail(409,'This payment is being processed. Contact support instead of releasing the seat.')
        execute(conn,"UPDATE app.reservations SET status='cancelled' WHERE id=%s",(reservation_id,))
        return {'id':reservation_id,'status':'cancelled'}
