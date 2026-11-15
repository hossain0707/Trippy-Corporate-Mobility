# Dhaka-wide practice booking — DEMO only

This feature is a **simulation** alongside the verified real-service catalog. It must never be presented as an actual bus, driver, pickup, payment, or boarding right.

## What passengers see

- When searching anywhere in Dhaka, users may see **Demo Bus** as a separately labeled practice experience. The demo result ignores the pickup/destination filters intentionally and appears only when bus/all vehicle types are selected.
- The practice bus has a shared 16-seat sample layout. A user signs in, selects a seat, enters two distinct Dhaka-area names, chooses 1/3/6/12 months, and confirms **DEMO BOOKED** at **৳0**.
- The system saves a booking for that authenticated account. Other users see the seat as occupied for overlapping dates, enforced by two PostgreSQL exclusion constraints; this is *shared demo inventory*, not real bus availability.
- My Passes separates **Demonstration bookings** from **Real reservations**. No SSLCOMMERZ request, paid hold, actual seat reservation, phone-verification requirement, or boarding right is created.

## Administrator lifecycle

1. Sign in with the verified administrator account and complete authenticator-app MFA (AAL2).
2. Open **Operations → Dhaka-wide demo services**.
3. Select inactive, unverified **DEMO-BUS-001**, enter a name that explicitly includes `Demo`, and select **Publish demo across Dhaka**.
4. Use **Hide from customers** to unpublish temporarily, **Publish demo** to restore, or **Remove demo** to soft-delete it from public search.
5. Removed demos are absent from new customer searches but previous `demo_booked` records remain visible to the owner of each booking. Audit history is retained.

**Note:** Removing a demo service does not remove the underlying unverified `app.vehicles` registry record. This intentionally separates demo publication from fleet registration. A new demo service may be created later from the same inactive demo vehicle.

## Backend boundaries

- Routes: `GET /api/demo/services`, `GET /api/demo/services/{id}/seats`, `POST /api/demo/services/{id}/bookings`, `GET /api/demo/me/bookings`.
- Admin: `GET /api/admin/demo/services`, `POST /api/admin/demo/services`, `PATCH /api/admin/demo/services/{id}`, `DELETE /api/admin/demo/services/{id}`.
- Database: `app.demo_services`, `app.demo_bookings` inside the private, non-Data-API-exposed `app` schema.
- Real routes and checkout remain untouched: `app.routes`, `app.services`, `app.reservations`, `app.payment_attempts`.
- Demo booking requires a verified Supabase Auth session; admin modifications require server-enforced `admin` role and MFA. All demo publication/removal/booking actions are recorded in `app.audit_events`.

## Deployment sequence

1. Apply `database/migrations/005_demo_booking.sql` to the development Supabase project; verify tables and exclusion constraints.
2. Run backend unit, frontend build, and PostgreSQL integration checks; review the PR.
3. Apply the additive migration to production **before** deploying the frontend/backend routes.
4. Deploy FastAPI and Cloudflare Pages from the reviewed GitHub commit; verify new API and browser behavior.
5. Publish only the already-existing unverified Demo Bus via the authorized admin API or dashboard; never falsify fitness/insurance or driver checks for live transport.
6. Smoke-test login, public demo visibility from multiple Dhaka searches, seat booking, occupied seats, My Passes, hiding and removing demos, and the real-service/payment regression paths.

## Operational limitations

- Demo pickup/destination text is **not validated against geocoded city boundaries**, because no actual vehicle will travel. State clearly in the interface that this is a demo.
- A single shared demo bus uses a simulated citywide seat pool; it does **not** imply that one bus can physically serve different routes simultaneously.
- Historic demo bookings are retained after removal for accountability; define a privacy retention/deletion policy before opening to the public.
- The existing fixture vehicle remains inactive and unverified. Never use its dummy registration in legal fleet records or paid service publication.

## Realistic checkout walkthrough (simulation only)

The **Try the demo checkout** action shows three stages:

1. **Seat and example itinerary.** Select an available numbered seat and provide two different Dhaka-area names. Choose the same 1-, 3-, 6- or 12-month duration as in search.
2. **Fare and mock payment selection.** The backend quotes the current bus/Hiace/car monthly tariff using the existing pricing module. It displays the sample base, example promotion, estimated total, and **actual amount collected ৳0**. For a 1-month plan the 20% welcome offer is **illustrative**, not evidence of eligibility for any real discount. Select a *simulated* payment method from bKash, Nagad, debit/credit card, or bank transfer, and acknowledge that no transaction will occur. No personal payment details, PIN, OTP, CVV or card number are requested or stored.
3. **Demo receipt.** The backend saves the mock method, sample fare and discount against the demo-only booking record, and returns a `DEMO-` reference. The receipt says **Simulated — NOT paid**. My Passes displays the same fare, simulated method, receipt reference and charged amount of ৳0, including for removed demo services.

**Never** treat the illustrated fare as paid revenue, an invoice, a tax receipt, a promise of vehicle service, or a successful payment gateway verification. Demo quote snapshots are immutable examples, not entries in `app.payment_attempts`. Historical demo records created before this upgrade appear as `Legacy demo booking / payment not processed`.

### Example current sample pricing

| Duration | Bus sample base | Example discount | Example total | Actual payment |
| --- | ---: | ---: | ---: | ---: |
| 1 month | ৳5,000 | 20% example welcome | ৳4,000 | **৳0** |
| 3 months | ৳15,000 | 25% | ৳11,250 | **৳0** |
| 6 months | ৳30,000 | 30% | ৳21,000 | **৳0** |
| 12 months | ৳60,000 | 35% | ৳39,000 | **৳0** |

Values above reflect the pricing module at time of documentation. The API, not the browser, calculates demo quotes, so tariff adjustments should update both the preview and saved snapshot. After all user-facing checks, verify the actual signed-in booking and receipt in a staging account before treating the workflow as fully QA-cleared.
