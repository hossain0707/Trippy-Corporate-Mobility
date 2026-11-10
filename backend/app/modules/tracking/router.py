"""Driver-controlled GPS updates and restricted, time-windowed passenger access."""
from uuid import UUID
from datetime import datetime,timezone
from fastapi import APIRouter,Depends
from ...core.clock import now
from ...core.database import connection,one,rows,execute
from ...core.errors import fail
from ...core.limits import throttle
from ...core.schemas import GpsPing
from ..auth.router import actor,require

router=APIRouter(prefix='/api',tags=['Vehicle tracking'])

@router.get('/driver/assignments')
def assignments(user=Depends(require('driver','admin'))):
    with connection() as conn:
        return rows(conn,'''SELECT a.service_id,s.code,s.morning_departure::text,s.evening_departure::text
           FROM app.driver_assignments a JOIN app.services s ON s.id=a.service_id
           WHERE a.driver_id=%s AND a.active AND s.active''',(user['id'],))

@router.post('/driver/location',status_code=202)
def location_ping(ping:GpsPing,user=Depends(require('driver'))):
    throttle('driver-location',user['id'],50,60)
    if ping.measuredAt.tzinfo is None or abs((datetime.now(timezone.utc)-ping.measuredAt).total_seconds())>120:
        fail(422,'Stale, future or timezone-free GPS event')
    with connection() as conn:
        assigned=one(conn,'''SELECT 1 FROM app.driver_assignments a JOIN app.services s ON s.id=a.service_id JOIN app.driver_compliance c ON c.driver_id=a.driver_id
            WHERE c.license_expires_on>=((now() AT TIME ZONE 'Asia/Dhaka')::date)
            AND a.driver_id=%s AND a.service_id=%s AND a.active AND s.active
            AND EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Asia/Dhaka'))::smallint=ANY(s.operating_days)
            AND (((now() AT TIME ZONE 'Asia/Dhaka')::time BETWEEN s.morning_departure - interval '1 hour' AND s.morning_departure + interval '4 hours')
             OR ((now() AT TIME ZONE 'Asia/Dhaka')::time BETWEEN s.evening_departure - interval '1 hour' AND s.evening_departure + interval '4 hours'))''',(user['id'],ping.serviceId))
        if not assigned: fail(403,'Only the assigned driver may send live GPS')
        execute(conn,'''INSERT INTO app.vehicle_locations(service_id,driver_id,latitude,longitude,accuracy_m,measured_at)
          VALUES(%s,%s,%s,%s,%s,%s)''',(ping.serviceId,user['id'],ping.latitude,ping.longitude,ping.accuracyMeters,ping.measuredAt))
    return {'accepted':True}

@router.get('/tracking/{service_id}')
def track(service_id:UUID,user=Depends(actor)):
    with connection() as conn:
        access=user['role'] in ('admin','dispatcher')
        if user['role']=='driver':
            access=bool(one(conn,'SELECT 1 FROM app.driver_assignments WHERE driver_id=%s AND service_id=%s AND active',(user['id'],service_id)))
        if not access:
            access=bool(one(conn,'''SELECT 1 FROM app.reservations b JOIN app.services s ON s.id=b.service_id
             WHERE b.user_id=%s AND b.service_id=%s AND b.status='confirmed'
             AND b.starts_on<=((now() AT TIME ZONE 'Asia/Dhaka')::date)
             AND b.ends_before>((now() AT TIME ZONE 'Asia/Dhaka')::date)
             AND EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Asia/Dhaka'))::smallint=ANY(s.operating_days)
             AND (((now() AT TIME ZONE 'Asia/Dhaka')::time BETWEEN s.morning_departure - interval '1 hour' AND s.morning_departure + interval '4 hours')
             OR ((now() AT TIME ZONE 'Asia/Dhaka')::time BETWEEN s.evening_departure - interval '1 hour' AND s.evening_departure + interval '4 hours'))
             LIMIT 1''',(user['id'],service_id)))
        if not access: fail(403,'Live GPS is available only to authorized passengers or operators')
        last=one(conn,'''SELECT latitude,longitude,accuracy_m,measured_at,received_at FROM app.vehicle_locations
           WHERE service_id=%s ORDER BY measured_at DESC LIMIT 1''',(service_id,))
    if not last: return {'state':'no_signal','location':None}
    age=max(0,int((datetime.now(timezone.utc)-last['measured_at']).total_seconds()))
    return {'state':'live' if age<=90 else 'stale','ageSeconds':age,'location':last}
