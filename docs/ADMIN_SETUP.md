# TRIPPY Owner Setup & Fleet Operations

> **Security boundary:** no default administrator ID, shared password, public "become admin" endpoint or role field in public signup. Supabase Auth establishes identity; PostgreSQL `app.users` controls roles. Staff writes require a verified account **and AAL2 MFA** outside development.

## 1. Choose the first owner account

1. Sign in at the deployed TRIPPY site using the Google account that should own the business.
2. Open **My account** and copy the **Supabase User ID** (UUID). This is an identifier, **not** an access token or password.
3. In your Supabase production project, visit **Authentication → Users**. Independently match the UUID and verified email to the intended owner account. If the user is not in `app.users`, wait for `/api/me` to succeed after sign-in.
4. Run the following *once* from an **owner-controlled private terminal** with an appropriately privileged database connection. **Do not run this command in the browser or through a public API.** The same database must contain the private `auth.users` schema, as in a normal Supabase PostgreSQL project.

   From the `backend` directory, with `DATABASE_URL` securely supplied by your runtime or secret manager:

   ```bash
   BOOTSTRAP_ADMIN=I_AUTHORIZE_BOOTSTRAP python -m scripts.bootstrap_admin \
      --auth-user-id "COPY_THE_VERIFIED_UUID_FROM_SUPABASE" \
      --email "verified-owner@example.com" \
      --confirm PROMOTE-FIRST-ADMIN
   ```

5. The script checks the private `auth.users` identity and email-confirmation timestamp, compares the email **to Supabase Auth (not the browser-editable profile)**, confirms the profile exists, takes a transaction-level advisory lock, refuses a second administrator bootstrap, promotes the one matching account, and inserts an audit record.
6. Verify `SELECT count(*) FROM app.users WHERE role='admin';` returns **1**. You can also inspect the audit event `admin.bootstrap`. Never log or share a user's OAuth token or database password.
7. Refresh TRIPPY (sign out and back in if needed), then open **Operations**. Follow **Set up / verify authenticator** to scan the QR code with an authenticator app, enter the six-digit code and establish an AAL2 session.

**Important:** the initial bootstrap intentionally grants only the **first** admin. Subsequent roles are allocated by the admin-only staff controls; normal public users can never choose their own roles. Do not directly run UPDATE statements in production as a substitute for this audited process.

**No dedicated admin password exists.** The verified account signs in with Google (or its configured Supabase method) and then its authenticator app.

## 2. Fleet operations in the dashboard

`Operations → Fleet operations workspace` contains four sections:

| Section | What the authorized administrator does |
| --- | --- |
| **Vehicles & seats** | Register real bus / Hiace / car; adjust the draft seat map to the actual cabin; verify documents and activate vehicle |
| **Stops & routes** | Register approved pickup points and define ordered morning plus reverse evening corridors |
| **Timetables** | Create service code, assign verified vehicle/corridor, departure times and operating weekdays |
| **Drivers & roles** | Grant verified driver role, inspect driving licence and assign driver to the service |

**Publish:** Once the vehicle, seat map, stops, licence, assigned driver, and relevant documents have passed checks, use **Registered services → Activate service**. Only eligible, active services appear in customer search.

Before enabling bookings, verify with appropriate local transport counsel and operators that routes, passenger transport approvals, insurance, schedules and pickup points meet applicable Bangladesh requirements.

### Actual cabin inspection

- The default bus, Hiace and car templates are **drafts**, not verified passenger cabin diagrams.
- Use **Inspect and correct vehicle cabin** before **Physical fleet verification**.
- Only add genuinely bookable passenger seats. Driver seats, aisles and emergency exits must remain unavailable.
- The physical layout cannot be edited after the vehicle has a reservation: use a reviewed vehicle migration process.
- This version tracks vehicle document verification metadata and expiry dates, **not uploaded document files**. Originals must be checked by the accountable fleet operator. Encrypted document upload, scanned-file security and retention need their own separately reviewed implementation.

### No fabricated production inventory

- **Never** run `scripts.seed_demo` against staging/production.
- Do not label fictional vehicles as "approved" to populate the home page.
- There is a separate Dev Supabase project for staging experiments; maintain distinct callbacks, storage and database credentials for it.

## 3. Troubleshooting

| Symptom | Likely next action |
| --- | --- |
| No **Operations** tab | Sign in as the designated, bootstrapped admin; refresh to refetch `/api/me` |
| **Verify your staff account** panel | Complete TOTP MFA with the correct account and check Supabase MFA settings |
| `403` on admin API | Ensure database role is correct and the current access token has `aal=aal2` |
| New vehicle not in customer search | Vehicles need verified documents, licensed seats, current fitness/insurance, an approved route, a valid driver and an active service |
| Service remains **inactive** | Assign a verified driver and activate the service after all backend validation gates pass |
| First-admin bootstrap refused | Read the error: mismatching UUID/email, unconfirmed email, missing app profile, existing admin or absent private `auth.users` access |
| Active service not returned | Check search filters, actual zone spelling, route/vehicle active status and fitness/insurance expiry |

## 4. Operational release controls

- Maintain offsite database backups, access logs, least-privilege runtime roles and regular restore drills.
- Require a second person to review transport document validation, driver approvals, fleet manifests and payment changes before opening to the public.
- Keep production audit logs and MFA enforcement, and do not share staff accounts.
- Separate test and production identity projects; authenticate testing users in staging before enabling real payment operations.
- Run frontend and backend automated tests plus physical seat and route QA on real devices before inviting paying riders.

For deployment and release safeguards, see [Hosted rollout](HOSTED_ROLLOUT.md) and [Production readiness](PRODUCTION_READINESS.md).
