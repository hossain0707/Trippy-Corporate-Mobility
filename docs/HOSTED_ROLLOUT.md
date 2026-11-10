# Hosted rollout

## Start with a separate review environment

| Layer | Starting configuration | Watch before launch |
| --- | --- | --- |
| Web | Cloudflare Pages Free, Vite static build | Build quota, domain and applicable account terms |
| API | Cloud Run, request-based billing, 0 minimum instances, 1 maximum instance, 512 MiB, port 8000 | Cold starts, request latency, egress and build/image/logging charges |
| Data and identity | Supabase Auth and managed PostgreSQL in a region close to the API | Inactivity pausing, database capacity, connection limits and tested restores |
| Messaging | Custom SMTP for signup and recovery, supported SMS provider for verified checkout phone numbers | Delivery rates, abuse controls and per-message costs |
| Payments | SSLCOMMERZ sandbox merchant in review | Live merchant approval, settlement, reconciliation and refunds |

Cloud Run requires a billing account. Free usage is an allowance. Configure alerts and quotas before provisioning. A Cloud Run instance limit reduces exposure and does not cap the total cloud bill. Vercel Hobby is restricted to personal, non-commercial use. For a Vercel deployment, use a plan appropriate for the actual use.

Provider references: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Cloud Run pricing](https://cloud.google.com/run/pricing), [Supabase inactivity pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Vercel Hobby](https://vercel.com/docs/plans/hobby).

## Bring up review

1. Create separate review and live provider projects. Review uses `APP_ENV=staging` and `SSLCOMMERZ_MODE=sandbox`. Use a review-only Supabase project, database, OAuth configuration and merchant. Keep access to the review deployment limited to designated testers.
2. Apply repository migrations from a trusted runner with `cd backend && DATABASE_URL=... python -m scripts.migrate`. Supply the credential from a secret manager. Use a migration owner and a separate limited runtime role with privileges only for the app schema, its tables and sequences. Keep the `app` schema out of the Supabase Data API exposed schema list.
3. Build the image with `docker build -t trippy-api ./backend`, publish it to your registry, and deploy it to Cloud Run on port 8000. Use `DATABASE_POOL_MAX_SIZE=4` initially, and a TLS-verified PostgreSQL connection string. Use session pooling if direct connectivity is unavailable. Set `WEB_ORIGIN` to the exact web HTTPS origin and `PUBLIC_BASE_URL` to the API HTTPS URL. Set Supabase URL and publishable key in the backend. Bind database and merchant secrets through the hosting secret manager. Check `/health/ready` after migrations and rollout.
4. Build the web app with root `frontend`, command `npm ci && npm run build`, and output directory `dist`. Set `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Only browser-safe credentials belong in `VITE_*` values. Set `VITE_SOCIAL_PROVIDERS=google,facebook` only if both are configured. Set `VITE_PHONE_AUTH=true` after connecting and testing SMS. Verify published browser headers on the deployed origin.
5. In Supabase Auth, require email confirmation, set a minimum password length of 12, configure auth rate limits, set up custom SMTP and configure allowed redirect URLs using exact HTTPS origins. Configure each provider's Supabase callback in its OAuth console. Use the Supabase provider setup instructions for [Google](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook). Test signup, verification, reset and provider login with real review accounts. Phone verification is required before checkout.
6. Bootstrap the first administrator from a trusted terminal using the [owner procedure](../README.md#run-locally). In My account, enroll a TOTP authenticator and verify the code. Hosted staff tools require an AAL2 session. Register only authorized and physically verified routes, vehicles and stops. The published frontend builds from `frontend/` and contains no seed routes. A new database shows an empty route list until staff publish verified services.

## Promote to live

Follow [production release gates](PRODUCTION_READINESS.md). Verify administrator MFA, payment reconciliation and refunds, transport approval and fleet documentation, restore drills, operational support, mobile accessibility and location privacy. Complete real payment and GPS verification with approved devices, routes and accounts before opening the service to paying riders. Review domain, SMTP, SMS, map, merchant and hosting terms and budgets separately. Retain a previous image and static build for rollback and review database migration compatibility before reverting a backend.
