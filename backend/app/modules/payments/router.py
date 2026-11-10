"""One checkout per hold; verified, idempotent IPN confirmation; manual review on late/risky payment."""
from hashlib import sha256
from uuid import UUID,uuid4
from datetime import datetime,timezone
from fastapi import APIRouter,Depends,Request
from fastapi.responses import RedirectResponse
from ...core.database import connection,one,execute
from ...core.config import settings
from ...core.errors import fail
from ...core.limits import throttle
from ..auth.router import actor
from .gateway import Gateway,verified_amount

router=APIRouter(prefix='/api',tags=['Payments'])

@router.post('/reservations/{reservation_id}/checkout')
def checkout(reservation_id:UUID,user=Depends(actor)):
    throttle('checkout',user['id'],8,60)
    with connection() as conn:
        book=one(conn,'''SELECT b.*,u.full_name,u.phone,u.email,s.code FROM app.reservations b
          JOIN app.users u ON u.id=b.user_id JOIN app.services s ON s.id=b.service_id
          WHERE b.id=%s AND b.user_id=%s FOR UPDATE OF b''',(reservation_id,user['id']))
        if not book: fail(404,'Reservation not found')
        if book['status']!='held' or book['hold_expires_at']<=datetime.now(timezone.utc):
            fail(409,'Seat hold expired; choose again')
        if not book['phone'] or not book['email'] or len(book['full_name'].strip())<2:
            fail(422,'Complete name, verified phone and billing email in your profile')
        attempt=one(conn,'SELECT * FROM app.payment_attempts WHERE reservation_id=%s ORDER BY created_at DESC LIMIT 1',(reservation_id,))
        if attempt:
            if attempt['status']=='initiated' and attempt['checkout_url']:
                return {'checkoutUrl':attempt['checkout_url']}
            fail(409,'Checkout already started; contact support if it cannot be resumed')
        reference='TC-'+uuid4().hex[:25]
        attempt=one(conn,'''INSERT INTO app.payment_attempts(reservation_id,merchant_tran_id,amount_bdt)
           VALUES(%s,%s,%s) RETURNING id''',(reservation_id,reference,book['amount_bdt']))
        execute(conn,"UPDATE app.reservations SET hold_expires_at=now()+interval '20 minutes' WHERE id=%s",(reservation_id,))
    # External HTTP is outside any long-lived database transaction.
    session=Gateway().start(reference,book['amount_bdt'],book)
    with connection() as conn:
        execute(conn,'''UPDATE app.payment_attempts SET status='initiated',checkout_url=%s,gateway_session_id=%s WHERE id=%s''',
                (session['checkoutUrl'],session['sessionId'],attempt['id']))
    return {'checkoutUrl':session['checkoutUrl']}

@router.post('/payments/sslcommerz/ipn')
async def ipn(request:Request):
    # Notification is untrusted; the provider validation API is the only authority.
    form=await request.form()
    transaction_id=str(form.get('tran_id') or '')[:120]
    validation_id=str(form.get('val_id') or '')[:120]
    if not transaction_id or not validation_id: fail(400,'Invalid payment notification')
    with connection() as conn:
        attempt=one(conn,'SELECT id FROM app.payment_attempts WHERE merchant_tran_id=%s',(transaction_id,))
    if not attempt: fail(404,'Unknown transaction reference')
    provider=Gateway().validate(validation_id)
    with connection() as conn:
        attempt=one(conn,'SELECT * FROM app.payment_attempts WHERE merchant_tran_id=%s FOR UPDATE',(transaction_id,))
        book=one(conn,'SELECT * FROM app.reservations WHERE id=%s FOR UPDATE',(attempt['reservation_id'],))
        if attempt['status']=='verified' and book['status']=='confirmed':
            return {'outcome':'already_confirmed'}
        payload_signature=sha256(f'{transaction_id}:{validation_id}'.encode()).hexdigest()
        execute(conn,'''INSERT INTO app.payment_notifications(attempt_id,payload_sha256)
           VALUES(%s,%s) ON CONFLICT DO NOTHING''',(attempt['id'],payload_signature))
        if not verified_amount(provider,attempt['amount_bdt'],transaction_id):
            # Invalid notifications do NOT mutate a hold or invent a payment.
            fail(422,'Provider did not validate this transaction and amount')
        if attempt['gateway_validation_id'] and attempt['gateway_validation_id']!=validation_id:
            fail(409,'Conflicting gateway validation reference')
        risk=str(provider.get('risk_level',1))
        user=one(conn,'SELECT * FROM app.users WHERE id=%s FOR UPDATE',(book['user_id'],))
        previous=one(conn,"SELECT 1 FROM app.reservations WHERE user_id=%s AND id<>%s AND status='confirmed' LIMIT 1",(book['user_id'],book['id']))
        invalid_hold=(book['status']!='held' or book['hold_expires_at']<=datetime.now(timezone.utc))
        welcome_conflict=book['applies_welcome_offer'] and (user['welcome_redeemed_at'] is not None or previous)
        if risk!='0' or invalid_hold or welcome_conflict:
            execute(conn,"UPDATE app.payment_attempts SET status='review',gateway_validation_id=%s WHERE id=%s",(validation_id,attempt['id']))
            execute(conn,"UPDATE app.reservations SET status='payment_review' WHERE id=%s",(book['id'],))
            return {'outcome':'manual_review_required'}
        execute(conn,"UPDATE app.payment_attempts SET status='verified',gateway_validation_id=%s,verified_at=now() WHERE id=%s",
                (validation_id,attempt['id']))
        execute(conn,"UPDATE app.reservations SET status='confirmed',confirmed_at=now() WHERE id=%s",(book['id'],))
        if book['applies_welcome_offer']:
            execute(conn,'UPDATE app.users SET welcome_redeemed_at=now() WHERE id=%s',(book['user_id'],))
        execute(conn,"INSERT INTO app.audit_events(actor_id,action,target_id) VALUES(%s,'payment.confirmed',%s)",(book['user_id'],book['id']))
    return {'outcome':'confirmed'}

@router.api_route('/payments/sslcommerz/return',methods=['GET','POST'])
def return_url():
    # Browser return is NEVER used to confirm payments.
    return RedirectResponse(settings().web_origin.rstrip('/')+'/?payment=processing',status_code=303)
