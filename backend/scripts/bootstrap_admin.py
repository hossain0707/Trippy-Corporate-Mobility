"""Owner-only, auditable bootstrap of the first administrator.

Requires a verified Supabase Auth identity already provisioned in app.users.
Intentionally cannot be called through HTTP, the browser or a signup form.
Only run from a private, authorized database administration environment.
"""
import argparse
import os
from uuid import UUID

from app.core.database import open_pool, close_pool, connection, one, execute

CONFIRMATION = 'PROMOTE-FIRST-ADMIN'
OWNER_FLAG = 'I_AUTHORIZE_BOOTSTRAP'


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description='Grant the first TRIPPY administrator role securely')
    parser.add_argument('--auth-user-id', required=True, type=UUID,
                        help='Exact Supabase Auth User UID from Authentication > Users')
    parser.add_argument('--email', required=True,
                        help='Exact confirmed email address of this Supabase Auth user')
    parser.add_argument('--confirm', required=True, choices=[CONFIRMATION],
                        help='Explicit human acknowledgement of first-admin promotion')
    return parser.parse_args(argv)


def bootstrap(auth_user_id, email):
    expected_email = email.strip().casefold()
    if not expected_email or '@' not in expected_email:
        raise ValueError('A confirmed Supabase Auth email address is required')

    open_pool()
    try:
        with connection() as conn:
            # Serialize owner bootstrap attempts; two parallel operators cannot create two admins.
            one(conn, 'SELECT pg_advisory_xact_lock(77221011) AS locked')
            if one(conn, "SELECT 1 FROM app.users WHERE role='admin' LIMIT 1"):
                raise ValueError('A first administrator already exists; refusing bootstrap')

            # Fail closed unless this DB can verify the identity in the private auth schema.
            identity = one(conn, '''SELECT id,email,email_confirmed_at
                FROM auth.users WHERE id=%s''', (auth_user_id,))
            if not identity or not identity['email_confirmed_at']:
                raise ValueError('Supabase Auth user not found or email not verified')
            if (identity['email'] or '').casefold() != expected_email:
                raise ValueError('Email does not match the authenticated Supabase identity')

            account = one(conn, '''SELECT id,role FROM app.users
                WHERE auth_user_id=%s FOR UPDATE''', (auth_user_id,))
            if not account:
                raise ValueError('Sign in to TRIPPY once before administrator bootstrap')
            if account['role'] != 'rider':
                raise ValueError('Initial administrator must be a normal verified rider account')

            promoted = one(conn, '''UPDATE app.users SET role='admin',email=%s
                WHERE id=%s AND role='rider' RETURNING id''',
                (identity['email'], account['id']))
            if not promoted:
                raise ValueError('Administrator promotion failed')
            execute(conn, '''INSERT INTO app.audit_events(actor_id,action,target_id,detail)
                VALUES(%s,'admin.bootstrap',%s,'{"method":"verified_supabase_identity"}'::jsonb)''',
                (promoted['id'], promoted['id']))
            return promoted['id']
    finally:
        close_pool()


def main():
    args = parse_args()
    if os.getenv('BOOTSTRAP_ADMIN') != OWNER_FLAG:
        raise SystemExit('Set BOOTSTRAP_ADMIN=I_AUTHORIZE_BOOTSTRAP in a private operator terminal')
    try:
        account_id = bootstrap(args.auth_user_id, args.email)
    except (ValueError, PermissionError) as exc:
        raise SystemExit(f'First-admin bootstrap refused: {exc}') from exc
    print('First administrator assigned to existing verified account:', account_id)
    print('Sign out and sign back in, then complete authenticator-app MFA before opening Operations.')


if __name__ == '__main__':
    main()
