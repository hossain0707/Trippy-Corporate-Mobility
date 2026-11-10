# Contributor guide (authorized team members only)

This is proprietary source code, not an invitation for public reuse. Contact the repository owner for an authorized contributor agreement before submitting code.

## Workflow

1. Create an issue that contains **no user or operational personal data** and define acceptance criteria.
2. Branch from `main` as `feature/<ticket>-<topic>`, `fix/<ticket>-<topic>`, or `chore/<topic>`.
3. Keep Python backend under `backend/`, web UI under `frontend/`, SQL under `database/migrations/`, and deployment code under `infra/`; do not move business logic to the browser.
4. Add tests to the relevant module. Modify shared API contracts and documentation together. Never rewrite a migration already deployed to any shared environment.
5. Open a pull request, attach tests and risk notes, and request review from the module owner.
6. Never merge failing CI. Require an independent reviewer for auth, payments, pricing, seat allocation, GPS, or vehicle compliance changes.

## Validation

```bash
cd backend && python -m pip install -r requirements-dev.txt && pytest -q
cd ../frontend && npm ci && npm run check && npm test && npm run build
```

The concurrency test needs a disposable PostgreSQL database with migrations applied and `TEST_DATABASE_URL` configured. Browser-based functional, accessibility, performance, payment, and real-device tests are additional mandatory gates before launch.

## Team ownership

See [team handoff](docs/TEAM_HANDOFF.md) and [module boundaries](docs/ARCHITECTURE.md). A code change requiring environment-specific secrets must document **names** of secrets but never their values.
