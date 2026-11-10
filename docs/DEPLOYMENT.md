# Developer deployment and release guide

## Local development

1. Install Docker Engine and Compose. Copy `.env.example` to `.env`, set development-only credentials.
2. Configure a **separate test** Supabase project with a legitimate SMS/OTP provider. Set the *publishable* key in frontend build-time variables; keep the merchant password server-only.
3. Run `docker compose up --build` from the repository root. Compose starts Postgres, applies numbered SQL migrations, then brings up FastAPI and the static frontend.
4. Open `http://localhost:5173` and `http://localhost:8000/api/docs`. The latter is intentionally disabled under `APP_ENV=production`.
5. Optional fictitious routes may be created only after acknowledging the seed safety flag as described in the root README. Do not seed production.

## Staging

- Use isolated PostgreSQL, real HTTPS callback URLs and **sandbox** merchant credentials.
- Run unit tests, PostgreSQL concurrency integration, clean-start database migrations, browser flows, OTP edge cases, gateway/IPN idempotency and GPS permission tests.
- Review logging for personal data; test backup/restore and rollback.

## Production — deployment BLOCKED until approvals

- Obtain all operational/transport authorizations; verify real drivers, fleet, stops, customer terms, refund policy and emergency procedures.
- Provide private managed PostgreSQL, autoscaled/containerized FastAPI, hosted static frontend, TLS, WAF, secrets manager, backups, alerting and incident on-call.
- Verify live merchant deposits/reconciliation, invalid notifications, retried IPNs and late settlement manually against provider records.
- Maintain a signed release record showing all checklist gates closed and named approvers. Never enable live payments only because CI is green.

## Rollback planning

Keep deploys immutable and backwards-compatible with additive database migrations. Don't rewrite migrations that have already run. Before non-reversible schema changes, make and restore-test a backup in staging; coordinate a data migration and cutover window. Disabling checkout safely is preferable to serving inconsistent seat inventory.
