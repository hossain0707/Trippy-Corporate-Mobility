# API ownership and versioning rules

- API base: `/api`. FastAPI generates OpenAPI under `/api/openapi.json` in non-production environments. Document public/authorized/admin routes in [API.md](API.md).
- Frontend components must only call the backend through `frontend/src/core/context.js`; no database connections or merchant secrets in browser code.
- Domain model: catalog publishes verified routes/vehicles; booking owns time-range holds and server price; payment owns external checkout+validation; tracking owns authorized GPS access; admin approves fleet/driver compliance.
- Every mutation requires authorization, server validation, stable error codes, predictable idempotency when money or seat inventory is involved, and corresponding tests.
- Prefer backwards-compatible additive response fields. Coordinate destructive changes behind a versioned migration/deprecation plan.
- New endpoint PRs must include an OpenAPI screenshot or schema diff, negative authorization tests, and example failure responses using fictional data.
