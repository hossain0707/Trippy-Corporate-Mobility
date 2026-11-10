# Release gates: launch only after all are verified

## Technical verification

- [ ] `docker compose` runs on a connected machine; all four migrations applied successfully
- [ ] Python unit tests + PostgreSQL integration concurrency test pass against disposable database
- [ ] Frontend `npm ci`, unit tests and `npm run build` pass using the committed lockfile
- [ ] End-to-end real OTP, expired/reused token and admin role test pass
- [ ] Concurrent booking load test (50 riders/requests, distinct + same seat), expiry and replay test pass
- [ ] Live route-map ETA / distance-to-stop uses a licensed routing provider (current nearby-stop UX is straight-line only)
- [ ] SSLCOMMERZ sandbox then live merchant verified: session, IPN, duplicate IPN, invalid val_id, mismatched amount/currency, late settlement, risk and refunds
- [ ] Server-to-server reconciliation process implemented and tested for lost IPNs and disputes
- [ ] Passenger and driver role/route/GPS IDOR tests pass; staff MFA implemented
- [ ] HTTPS for frontend + API + external callback; no public Postgres port
- [ ] Ingress-level rate limits, WAF/bot protection, SMS antifraud and login abuse controls
- [ ] Tested encrypted database backup, point-in-time recovery, restore drills, retention and deletion jobs
- [ ] Monitoring, alerting, exception capture, status pages, runbooks and incident management
- [ ] Full WCAG keyboard/screen-reader navigation and actual phone device/browser QA
- [ ] Pinned transitive dependencies, lockfiles, image digest pinning, dependency scanning and penetration test

## Real-world fleet and operations

- [ ] Local counsel/BRTA confirm correct legal category, routes, approvals and contracts for scheduled subscription commuter transport in Dhaka
- [ ] Vehicle registration, fitness and insurance verified from original documents, correct passenger capacity
- [ ] Seat map physically inspected per vehicle; driver seat and emergency exits never shown as bookable
- [ ] Valid, verified driver licenses and background/vetting requirements checked
- [ ] Safe and lawfully authorized pickup/drop-off points and accessible boarding policy
- [ ] Live driver GPS from appropriate native app/hardware with background permissions, mobile power/offline/replay handling
- [ ] Actual travel-time routes/ETAs, diversion/incident workflow, rider notification, alternative vehicle assignment
- [ ] Emergency response runbook and staffed support coverage; the generic support form is **not** an emergency hotline
- [ ] Published pricing, terms, route holiday schedule, renewal, refunds/transfer/cancellation, service interruptions and taxes
- [ ] Privacy impact assessment including live location visibility, consent, retention, user data rights, authorized access and local legal review

## Current state

**Not yet launched.** No real payment provider, device telemetry, driver roster, approved vehicles, permissions, DNS, email/SMS capacity or production data has been connected or certified. Existing infrastructure is a local-development Compose topology, not a production SRE-managed deployment.

## Repository handoff / legal

- [ ] Assign team members and enforce branch protection, status checks and CODEOWNERS reviews.
- [ ] Review TRIPPY LTD proprietary license and confirm contributor assignment agreements.
- [ ] Consider switching this repository to **private** before adding trade secrets; public visibility does not mean open-source licensing.
- [x] Commit a reproducible frontend lockfile; CI uses `npm ci`.
- [ ] Run full dependency audits, artifact scanning and container image digest pinning.
