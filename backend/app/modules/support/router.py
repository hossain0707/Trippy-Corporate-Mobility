"""Non-emergency support intake; no promises of automated emergency response."""
from uuid import UUID
from fastapi import APIRouter,Depends
from ...core.database import connection,one,rows,execute
from ...core.schemas import NewSupportTicket,SupportStatus
from ...core.errors import fail
from ...core.limits import throttle
from ..auth.router import actor,require

router=APIRouter(prefix='/api',tags=['Support and safety'])

@router.post('/support/tickets',status_code=201)
def create_ticket(d:NewSupportTicket,user=Depends(actor)):
    throttle('support',user['id'],4,3600)
    with connection() as conn:
        if d.serviceId and not one(conn,'SELECT 1 FROM app.services WHERE id=%s',(d.serviceId,)):
            fail(422,'Unknown route service')
        return one(conn,'''INSERT INTO app.support_tickets(user_id,service_id,category,message)
          VALUES(%s,%s,%s,%s) RETURNING id,status,created_at''',
          (user['id'],d.serviceId,d.category,d.message.strip()))

@router.get('/me/support')
def my_tickets(user=Depends(actor)):
    with connection() as conn:
        return rows(conn,'''SELECT id,category,message,status,created_at,updated_at
          FROM app.support_tickets WHERE user_id=%s ORDER BY created_at DESC LIMIT 100''',(user['id'],))

@router.get('/admin/support')
def staff_tickets(user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        return rows(conn,'''SELECT t.id,t.user_id,t.service_id,t.category,t.message,t.status,t.created_at
          FROM app.support_tickets t WHERE t.status IN ('open','in_progress') ORDER BY
          (CASE WHEN t.category='safety' THEN 0 ELSE 1 END),t.created_at LIMIT 100''')

@router.patch('/admin/support/{ticket_id}')
def update_ticket(ticket_id:UUID,d:SupportStatus,user=Depends(require('admin','dispatcher'))):
    with connection() as conn:
        ticket=one(conn,'''UPDATE app.support_tickets SET status=%s,updated_at=now()
           WHERE id=%s RETURNING id,status''',(d.status,ticket_id))
        if not ticket: fail(404,'Support ticket not found')
        execute(conn,'INSERT INTO app.audit_events(actor_id,action,target_id) VALUES(%s,%s,%s)',
            (user['id'],'support.status_changed',ticket_id))
        return ticket
