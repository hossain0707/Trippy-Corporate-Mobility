"""One-time owner-controlled bootstrap. Requires an already verified Supabase user."""
import argparse,os
from app.core.database import open_pool,close_pool,connection,one,execute


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--phone',required=True,help='Exact verified phone, e.g. +8801XXXXXXXXX')
    args=parser.parse_args()
    if os.getenv('BOOTSTRAP_ADMIN')!='I_AUTHORIZE_BOOTSTRAP':
        raise SystemExit('Set BOOTSTRAP_ADMIN=I_AUTHORIZE_BOOTSTRAP for this one-time action')
    open_pool()
    try:
        with connection() as conn:
            if one(conn,"SELECT 1 FROM app.users WHERE role='admin' LIMIT 1"):
                raise SystemExit('Bootstrap refused: an administrator already exists')
            user=one(conn,"SELECT id,phone FROM app.users WHERE phone=%s FOR UPDATE",(args.phone,))
            if not user: raise SystemExit('Verified user has not logged in; no matching account exists')
            execute(conn,"UPDATE app.users SET role='admin' WHERE id=%s",(user['id'],))
            execute(conn,"INSERT INTO app.audit_events(actor_id,action,target_id) VALUES(%s,'admin.bootstrap',%s)",(user['id'],user['id']))
            print('First administrator promoted:',user['id'])
    finally: close_pool()

if __name__=='__main__':main()
