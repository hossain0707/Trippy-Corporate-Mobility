"""Supabase OTP authentication is verified server-to-server on every protected request."""
from typing import Annotated
from uuid import UUID
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from ...core.database import connection, one
from ...core.config import settings
from ...core.schemas import ProfileUpdate
from ...core.errors import fail

router = APIRouter(prefix='/api',tags=['Identity'])

def actor(authorization:Annotated[str|None,Header()]=None):
    cfg=settings()
    if not authorization or not authorization.startswith('Bearer '):
        fail(401,'Verified login is required')
    if not cfg.supabase_url or not cfg.supabase_publishable_key:
        fail(503,'Authentication provider is not configured')
    token=authorization.removeprefix('Bearer ').strip()
    if not token or len(token)>8192:
        fail(401,'Invalid identity token')
    try:
        response=httpx.get(cfg.supabase_url.rstrip('/')+'/auth/v1/user',
            headers={'apikey':cfg.supabase_publishable_key,'Authorization':f'Bearer {token}'},timeout=cfg.request_timeout_seconds)
        if response.status_code != 200: fail(401,'Session invalid or expired')
        user=response.json()
        identity=UUID(str(user.get('id')))
    except (httpx.HTTPError,ValueError,KeyError,TypeError):
        fail(401,'Unable to verify user identity')
    if not user.get('phone_confirmed_at') and not user.get('email_confirmed_at'):
        fail(403,'A verified phone or email is required')
    # Claims about roles are NEVER accepted from phone/email metadata or browser inputs.
    with connection() as conn:
        dbuser=one(conn,'''INSERT INTO app.users(auth_user_id,email,phone,full_name)
          VALUES(%s,%s,%s,%s)
          ON CONFLICT(auth_user_id) DO UPDATE
          SET phone=COALESCE(EXCLUDED.phone,app.users.phone),
              email=COALESCE(app.users.email,EXCLUDED.email)
          RETURNING id,role,email,phone,full_name,welcome_redeemed_at''',
          (identity,user.get('email'),user.get('phone'),str((user.get('user_metadata') or {}).get('full_name') or '')[:120]))
    return dbuser

def require(*roles):
    def check(user=Depends(actor)):
        if user['role'] not in roles:
            fail(403,'Insufficient account permissions')
        return user
    return check

@router.get('/me')
def me(user=Depends(actor)):
    return user

@router.patch('/me')
def update_me(data:ProfileUpdate,user=Depends(actor)):
    with connection() as conn:
        return one(conn,'UPDATE app.users SET full_name=%s,email=%s WHERE id=%s RETURNING id,role,email,phone,full_name',
            (data.fullName,data.email,user['id']))
