# Deploy TRIPPY theme to the existing DEV service (IAP protected)

This runbook deploys code from **unmerged `feature/theam`** to the **existing** DEV Cloud Run service. It never touches `main`, PRD, the production Supabase project or the PRD domain.

| Scope | Value |
|---|---|
| Code | `feature/theam`, no branch merge |
| Google Cloud project | `trippy-corporate-mobility` |
| Cloud Run service | `trippy-api-dev` |
| Region | `asia-south1` |
| DEV URL | `https://trippy-api-dev-857629427086.asia-south1.run.app` |
| Database | Supabase DEV `jhfoxjqerwqpryjpoixy` |
| Database connection secret | Existing `trippy-dev-database-url` in Google Secret Manager |
| Access | Existing Cloud Run Identity-Aware Proxy **must remain enabled** |
| Payments | Sandbox/non-live only |

## Already prepared in feature/theam

- `Dockerfile.dev` builds the selected desktop homepage, phone web-app view and operations UI; then serves Vite assets and FastAPI from **the same** IAP-protected Cloud Run container.
- `frontend/src/core/dev-gate.js` keeps the DEV sign-in/sign-up screen visible, and the entire application hidden, until Supabase has authenticated the account **and** FastAPI has accepted it through `GET /api/me`.
- `VITE_DEV_GATE=true` is set only in the DEV Dockerfile. The isolated Cloudflare feature preview still displays the public design review.
- Backend client API uses `location.origin` in DEV builds, so tagged revision QA requests stay on the tagged DEV revision, not the older backend or PRD.
- `backend/app/dev_site.py` serves the UI only after all `/api/*` routes from the V2 FastAPI app.
- `deploy/dev/cloudbuild.yaml` builds a revision and publishes it with the `theam` tag and **0% traffic**, preserving the currently working DEV release while QA is performed.

The V2 DEV PostgreSQL migrations were applied previously; the migration gate is independent of this theme. Confirm on the DEV project before the release and do not run PRD migrations.

## Deployment (requires authenticated GCP project access)

The deployment script is **not** triggered by a public GitHub push. The operator must be authorized to use Google Cloud Build, Artifact Registry and the existing Cloud Run DEV service. If the service's IAP setting cannot be verified, the build exits without making changes.

From an authenticated Google Cloud Shell or approved runner:

```bash
git clone https://github.com/hossain0707/Trippy-Corporate-Mobility.git
cd Trippy-Corporate-Mobility
git switch feature/theam
git rev-parse HEAD  # Record the exact SHA
gcloud config set project trippy-corporate-mobility
gcloud run services describe trippy-api-dev --region asia-south1
```

Verify **Iap Enabled: true**, the existing secret binding (`DATABASE_URL` sourced from `trippy-dev-database-url`) and `APP_ENV=staging`; do not copy or print secret values. Confirm Artifact Registry repository `cloud-run-source-deploy` exists in `asia-south1`.

Find the **publishable browser key** of the DEV Supabase project (never use the `service_role` key) from the Supabase dashboard, then run:

```bash
read -rs DEV_PUBLISHABLE_KEY
echo
gcloud builds submit . \
  --project=trippy-corporate-mobility \
  --region=asia-south1 \
  --config=deploy/dev/cloudbuild.yaml \
  --substitutions="_DEV_PUBLISHABLE_KEY=${DEV_PUBLISHABLE_KEY}"
unset DEV_PUBLISHABLE_KEY
```

Build uses only the DEV Supabase URL and publishable browser key. The live database password stays attached to Cloud Run through its existing Secret Manager binding.

**Important:** The deploy command leaves 0% of public DEV traffic on the newly tagged revision. This avoids silently replacing the currently working DEV version. IAP remains configured at the Cloud Run *service*, not through frontend JavaScript.

## Test the tagged DEV revision

From Cloud Run → trippy-api-dev → Revisions, open the `theam` tagged revision URL while signed in as an existing authorized IAP tester.

Verify:

1. **Before sign-in**: only the DEV sign-in/sign-up form is visible (the application is not displayed).
2. **After authenticating**: the selected desktop hero appears, and Web View / Phone View switch works. Phones use bottom app navigation.
3. `/health/live` and `/health/ready` return success through IAP. Use the same revision origin.
4. `/api/services` connects to the isolated DEV DB and shows only verified, activated routes; intermediate stop matching works.
5. A test passenger can select the exact two stops, check morning/return availability, choose a seat, and place a hold. Confirm no actual payment occurs without configured sandbox and phone verification.
6. A verified DEV admin with MFA can access the staff Operations dashboard and review route requests. The public static `/theam/admin-preview.html` is explicitly sample-only.
7. Repeat in Safari/Chrome on a small phone, with Bangla and English. Check IAP redirects and authentication callbacks.

If an authorized DEV admin does not yet exist, do not bypass MFA or self-promote. Complete the audited owner onboarding first.

## Switch DEV traffic only after checks

Record the previous DEV revision name. Then, *only after the tagged revision is verified*, use:

```bash
gcloud run services update-traffic trippy-api-dev \
  --project=trippy-corporate-mobility \
  --region=asia-south1 \
  --to-tags=theam=100
```

If QA fails, keep the tag at 0% and leave the existing DEV live. To restore an earlier REVISION, use `gcloud run services update-traffic` with `--to-revisions=PREVIOUS_REVISION=100`. This never changes the PRD service.

### Connectivity caveat

The Google Cloud project and existing DEV Cloud Run service are **not directly controllable from the current ChatGPT chat tool connection**. The code and deployment pipeline in this branch do not imply a Cloud Run rollout has occurred. GitHub CI and Cloudflare Pages preview alone cannot prove this DEV deployment. Complete the authenticated GCP step and verify Cloud Run revision status before reporting DEV as published.
