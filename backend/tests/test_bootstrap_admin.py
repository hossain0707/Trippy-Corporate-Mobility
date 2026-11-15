"""Security regression tests; these use fake connections, NEVER a live database."""
from contextlib import nullcontext
from datetime import datetime, timezone
from uuid import UUID
from unittest.mock import Mock

import pytest
from scripts import bootstrap_admin as bootstrap


AUTH_UID = UUID('11111111-1111-4111-8111-111111111111')
APP_UID = UUID('22222222-2222-4222-8222-222222222222')


def fake_db(monkeypatch, *, exists=False, confirmed=True, matching_email=True, rider=True, profile=True):
    observed = []
    monkeypatch.setattr(bootstrap, 'open_pool', Mock())
    monkeypatch.setattr(bootstrap, 'close_pool', Mock())
    monkeypatch.setattr(bootstrap, 'connection', lambda: nullcontext(object()))

    def one(_conn, query, params=()):
        observed.append((query, params))
        if 'pg_advisory_xact_lock' in query:
            return {'locked': None}
        if "SELECT 1 FROM app.users WHERE role='admin'" in query:
            return {'exists': 1} if exists else None
        if 'FROM auth.users' in query:
            return {
                'id': AUTH_UID,
                'email': 'owner@example.com' if matching_email else 'someone-else@example.com',
                'email_confirmed_at': datetime.now(timezone.utc) if confirmed else None,
            }
        if 'FROM app.users' in query:
            return {'id': APP_UID, 'role': 'rider' if rider else 'driver'} if profile else None
        if 'UPDATE app.users SET role=' in query:
            return {'id': APP_UID}
        raise AssertionError('Unexpected query: '+query)

    monkeypatch.setattr(bootstrap, 'one', one)
    audit = Mock(return_value=1)
    monkeypatch.setattr(bootstrap, 'execute', audit)
    return observed, audit


def test_bootstrap_requires_existing_verified_identity(monkeypatch):
    fake_db(monkeypatch, confirmed=False)
    with pytest.raises(ValueError, match='not verified'):
        bootstrap.bootstrap(AUTH_UID, 'owner@example.com')


def test_bootstrap_refuses_preexisting_admin(monkeypatch):
    observed, _ = fake_db(monkeypatch, exists=True)
    with pytest.raises(ValueError, match='already exists'):
        bootstrap.bootstrap(AUTH_UID, 'owner@example.com')
    assert not any('FROM auth.users' in query for query, _ in observed)


def test_bootstrap_refuses_mismatched_supabase_identity(monkeypatch):
    fake_db(monkeypatch, matching_email=False)
    with pytest.raises(ValueError, match='does not match'):
        bootstrap.bootstrap(AUTH_UID, 'owner@example.com')


def test_bootstrap_refuses_non_rider_or_missing_profile(monkeypatch):
    fake_db(monkeypatch, rider=False)
    with pytest.raises(ValueError, match='normal verified rider'):
        bootstrap.bootstrap(AUTH_UID, 'owner@example.com')
    fake_db(monkeypatch, profile=False)
    with pytest.raises(ValueError, match='Sign in'):
        bootstrap.bootstrap(AUTH_UID, 'owner@example.com')


def test_bootstrap_succeeds_only_after_checks_and_audits(monkeypatch):
    observed, audit = fake_db(monkeypatch)
    result = bootstrap.bootstrap(AUTH_UID, 'OWNER@example.com')
    assert result == APP_UID
    assert any('UPDATE app.users SET role=' in query for query, _ in observed)
    assert any('pg_advisory_xact_lock' in query for query, _ in observed)
    audit.assert_called_once()
    assert 'admin.bootstrap' in audit.call_args.args[1]


def test_cli_requires_explicit_confirmation():
    with pytest.raises(SystemExit):
        bootstrap.parse_args(['--auth-user-id', str(AUTH_UID), '--email', 'owner@example.com'])
    args = bootstrap.parse_args([
        '--auth-user-id', str(AUTH_UID), '--email', 'owner@example.com',
        '--confirm', bootstrap.CONFIRMATION,
    ])
    assert args.auth_user_id == AUTH_UID
