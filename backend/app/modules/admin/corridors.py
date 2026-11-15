"""Audited corridor operations: demand triage and per-stop published timetables.

Active journeys and any service with reservations are immutable. To modify
stops, operators create a new route/corridor revision and schedule it.
"""
from uuid import UUID
from fastapi import APIRouter,Depends
from ...core.database import connection,one,rows,execute
from ...core.errors import fail
from ...core.schemas import DemandReview,ServiceTimetable
from ..auth.router import require

router=APIRouter(prefix='/api/admin',tags=['Corridor operations'])


def audit(conn,actor,action,target,detail='{}'):
    execute(conn,"""INSERT INTO app.audit_events(actor_id,action,target_id,detail)
                  VALUES(%s,%s,%s,%s::jsonb)""",
            (actor,action,target,detail))


@router.get('/demand/summary')
def demand_summary(user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return rows(conn,'''SELECT
           MIN(home_zone) AS pickup,
           MIN(office_zone) AS destination,
           request_kind,
           COUNT(*)::int AS total_requests,
           COUNT(*) FILTER(WHERE status='open')::int AS open_requests,
           COUNT(DISTINCT user_id)::int AS interested_riders,
           MAX(created_at) AS latest_request
          FROM app.demand_requests
          GROUP BY lower(trim(home_zone)),lower(trim(office_zone)),request_kind
          ORDER BY open_requests DESC,total_requests DESC,latest_request DESC
          LIMIT 100''')


@router.patch('/demand/{request_id}')
def review_request(request_id:UUID,data:DemandReview,
                   user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        current=one(conn,'''SELECT id,status FROM app.demand_requests
          WHERE id=%s FOR UPDATE''',(request_id,))
        if not current: fail(404,'Request not found')
        updated=one(conn,'''UPDATE app.demand_requests SET status=%s,resolution_note=%s,
            reviewed_by=%s,reviewed_at=now() WHERE id=%s
            RETURNING id,status,resolution_note,reviewed_at''',
          (data.status,data.resolutionNote,user['id'],request_id))
        audit(conn,user['id'],'demand.reviewed',request_id,
              '{"operation":"request_review"}')
        return updated


@router.get('/routes/{route_id}/stops')
def route_stop_order(route_id:UUID,user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        route=one(conn,'''SELECT id,name,home_zone,office_zone,active FROM app.routes
          WHERE id=%s''',(route_id,))
        if not route: fail(404,'Route not found')
        stops=rows(conn,'''SELECT rs.direction,rs.stop_order,rs.stop_id,
          st.name,st.zone,st.approved,st.active
          FROM app.route_stops rs JOIN app.stops st ON st.id=rs.stop_id
          WHERE rs.route_id=%s ORDER BY rs.direction,rs.stop_order''',(route_id,))
        return {'route':route,'stops':stops}


@router.get('/services/{service_id}/timetable')
def get_timetable(service_id:UUID,user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        service=one(conn,'''SELECT s.id,s.code,s.route_id,s.active,
          s.morning_departure::text,s.evening_departure::text
          FROM app.services s WHERE s.id=%s''',(service_id,))
        if not service: fail(404,'Service not found')
        times=rows(conn,'''SELECT rs.direction,rs.stop_order,rs.stop_id,
          st.name,st.zone,tm.planned_arrival::text AS planned_arrival
          FROM app.route_stops rs
          JOIN app.stops st ON st.id=rs.stop_id
          LEFT JOIN app.service_stop_times tm ON tm.service_id=%s
            AND tm.direction=rs.direction AND tm.stop_id=rs.stop_id
          WHERE rs.route_id=%s ORDER BY rs.direction,rs.stop_order''',
          (service_id,service['route_id']))
        return {'service':service,'stops':times}


def save_timetable(conn,service_id,data:ServiceTimetable):
    service=one(conn,'''SELECT id,route_id,active,morning_departure,evening_departure
      FROM app.services WHERE id=%s FOR UPDATE''',(service_id,))
    if not service: fail(404,'Service not found')
    if service['active'] or one(conn,'''SELECT 1 FROM app.reservations
       WHERE service_id=%s LIMIT 1''',(service_id,)):
        fail(409,'Do not edit an active or previously booked timetable; create a new service')
    assigned=rows(conn,'''SELECT direction,stop_id,stop_order
       FROM app.route_stops WHERE route_id=%s
       ORDER BY direction,stop_order''',(service['route_id'],))
    expected={(s['direction'],s['stop_id']) for s in assigned}
    provided={(s.direction,s.stopId) for s in data.stops}
    if len(expected)<4 or len(data.stops)!=len(expected) or provided!=expected:
        fail(422,'Enter one timetable entry for every stop in both directions')
    lookup={(s.direction,s.stopId):s.plannedArrival for s in data.stops}
    for direction,first_departure in (
        ('morning',service['morning_departure']),
        ('evening',service['evening_departure'])
    ):
        sequence=[lookup[(s['direction'],s['stop_id'])] for s in assigned
                  if s['direction']==direction]
        if sequence[0]!=first_departure:
            fail(422,'The first '+direction+' time must match its service departure')
        if any(x>=y for x,y in zip(sequence,sequence[1:])):
            fail(422,'Stop arrival times must strictly increase in travel order')
    execute(conn,'DELETE FROM app.service_stop_times WHERE service_id=%s',(service_id,))
    for item in data.stops:
        execute(conn,'''INSERT INTO app.service_stop_times
          (service_id,direction,stop_id,planned_arrival) VALUES(%s,%s,%s,%s)''',
          (service_id,item.direction,item.stopId,item.plannedArrival))
    return {'serviceId':service_id,'configuredStops':len(data.stops),'readyForReview':True}


@router.put('/services/{service_id}/timetable')
def set_timetable(service_id:UUID,data:ServiceTimetable,
                  user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        result=save_timetable(conn,service_id,data)
        audit(conn,user['id'],'service.timetable_configured',service_id)
        return result
