# Team onboarding and ownership map

| Team | Owns | Daily check | Must not change without review |
|---|---|---|---|
| Backend / Python | `backend/app/modules`, core API | `pytest`, `/health/ready`, error logs | PostgreSQL exclusion rules, payment verification, ACL |
| Frontend / UX | `frontend/src/features`, `frontend/src/style.css` | `npm run check`, `npm test`, browser check | Browser auth handoff and API shapes |
| Database | `database/migrations` | schema diff, backup/restore, query plans | Applied migrations, production data, seat constraints |
| Fleet operations | route/seat verification records, driver vetting | licenses, approved stops, seats and schedule | Price and confirmed reservation history |
| Infrastructure / SRE | `compose.yaml`, `infra`, CI | uptime, alerts, TLS, backup, WAF | Production secrets or direct admin DB changes |
| QA/Security | `backend/tests`, `frontend/test`, release checklist | regression, abuse, concurrency, device tests | No unreviewed acceptance of production risks |

## Suggested branch workflow

- Keep a protected `main` branch; one PR per feature (e.g. `feature/booking-hold-expiry`, `feature/seat-map-editor`).
- Backend contract changes should update OpenAPI, unit/integration tests and affected frontend feature in one coordinated release.
- Every database migration receives a database-team review and rollback/backup plan. Never edit previously released migrations.
- Every payment/auth/seat allocation PR requires a second security reviewer.
- Admin operations must leave an audit trail.

## Local setup order

1. Copy `.env.example` to `.env` and configure credentials.
2. `docker compose up --build`; migrator runs before API.
3. (Optional **fake local only**) `ALLOW_FAKE_RIDES=YES_I_UNDERSTAND docker compose run --rm -e ALLOW_FAKE_RIDES=YES_I_UNDERSTAND api python -m scripts.seed_demo`.
4. Sign in through Supabase OTP; one-time bootstrap for first administrator; staff verify real routes/vehicles in a non-demo environment.
5. Run tests and review release gates before staging promotion.

## API changes

API docs exist at `/api/docs` only in development/staging. Prefer the generated OpenAPI schema over guessed HTTP payloads. See `docs/API.md` for route matrix.
