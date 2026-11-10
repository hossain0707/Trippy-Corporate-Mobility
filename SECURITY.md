# Security policy

## Responsible reporting

Do **not** post suspected vulnerabilities, customer data, access tokens, or payment credentials in public issues, comments, screenshots, or pull requests. Contact a trusted TRIPPY LTD repository administrator privately using your team's approved incident channel. Configure GitHub private vulnerability reporting for this repository before inviting external security reports.

## Supported environments

| Environment | Intended use | Public traffic |
|---|---|---|
| Offline `preview/` | Demonstration UI only | No payments, no real accounts |
| Local `compose.yaml` | Development and tests | Loopback only |
| Staging | Controlled integration and security verification | Restricted |
| Production | **Not deployed or approved** | Blocked until all release gates close |

## Security invariants

- No secrets, service-role keys, merchant passwords, or `.env` files in Git.
- The frontend receives only public publishable keys; it never reaches PostgreSQL directly.
- User identity is validated server-side. Staff roles are stored in the application database, not user-editable metadata.
- Payment notifications are **untrusted** until independently validated with the merchant API. Browser redirects are never proof of payment.
- PostgreSQL transaction locks and exclusion constraints—not browser UI—control overlapping seats.
- GPS access is restricted by assigned driver and active confirmed subscriptions. Review retention periods under applicable law.
- Public issue trackers are not safe for private rider, driver, license, or location information.

## Before production

Complete SAST, dependency and secret scans; a paid external penetration test; mobile accessibility and abuse tests; rate limiting at an edge/WAF; MFA for staff; credential rotation; encrypted backups and restore drills; event monitoring; and payment-ledger reconciliation. See [release gates](docs/PRODUCTION_READINESS.md).
