# REST API reference (implemented routes)

Base URL: `/api`; authentication = verified Supabase access-token `Authorization: Bearer <token>`, except public catalog and SSLCOMMERZ gateway callback.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/pricing` | Public | BDT fares and discounts |
| GET | `/services` | Public | Verified morning/evening commuter routes, filter by zone/class |
| GET | `/services/{id}` | Public | Approved stops + route/vehicle schedule |
| GET | `/services/{id}/seats?startDate=YYYY-MM-DD&months=3` | Public | Real physical seat availability over full date period |
| GET/PATCH | `/me` | Rider | Retrieve/update verified profile |
| GET | `/me/reservations` | Rider | Subscription passes |
| POST | `/reservations/hold` | Rider | Idempotent 10-minute hold; physical seat ID, date, stops, months |
| POST | `/reservations/{id}/release` | Rider | Release unpaid seat hold, not payments in progress |
| POST | `/reservations/{id}/checkout` | Rider | Hosted checkout creation; extended 20-minute hold |
| POST | `/payments/sslcommerz/ipn` | Provider (untrusted) | Server-side validation before confirming |
| GET/POST | `/payments/sslcommerz/return` | Provider/browser | Redirect only; **never** confirms payment |
| POST | `/demand` | Rider | Request additional route/vehicle capacity |
| POST | `/support/tickets` | Rider | Non-emergency concern report |
| GET | `/me/support` | Rider | Own tickets |
| GET | `/tracking/{serviceId}` | Active rider/assigned driver/staff | Fresh/stale GPS if authorized |
| GET | `/driver/assignments` | Driver/staff | Duty services |
| POST | `/driver/location` | Authorized driver | Location telemetry |
| GET | `/admin/overview`, `/admin/demand`, `/admin/support` | Staff | Operations queues |
| PATCH | `/admin/support/{ticketId}` | Staff | Ticket processing |
| GET/POST | `/admin/stops` | Staff/Admin* | Approved boarding places |
| GET/POST | `/admin/vehicles` | Staff/Admin* | Verified physical fleet |
| GET/PUT | `/admin/vehicles/{id}/seats` | Staff/Admin* | Inspect / replace unverified cabin coordinates |
| PATCH | `/admin/vehicles/{id}/verify` | Admin | Real documentation/cabin approval |
| GET/POST | `/admin/routes` | Staff | Ordered stops, reverse evening route |
| GET/POST | `/admin/services` | Staff | Timetables, vehicle assignment |
| PATCH | `/admin/services/{id}/activate` | Staff | Activate after all verification gates |
| POST | `/admin/driver-assignments` | Staff | Assign vetted driver to service |
| PATCH | `/admin/users/{id}/role` | Admin | Grant rider/driver/dispatcher role |
| POST | `/admin/drivers/{id}/verify` | Admin | Approve inspected driving license |
| GET | `/admin/payments/review` | Admin | Pending reconciliation queue |

*Administrative route methods have stricter Admin-only roles for mutations as specified in source code. Route and service creation allow dispatchers; vehicle edits, verification and staff roles require administrators.*

Example reservation hold:

```json
{
  "serviceId":"00000000-0000-4000-8000-000000000001",
  "seatId":"00000000-0000-4000-8000-000000000002",
  "startDate":"2026-11-15",
  "months":3,
  "pickupStopId":"00000000-0000-4000-8000-000000000003",
  "dropoffStopId":"00000000-0000-4000-8000-000000000004",
  "idempotencyKey":"00000000-0000-4000-8000-000000000005"
}
```

These UUIDs are **examples only**, not real bookable identifiers. The server computes all money and dates and returns a conflict when a hold overlaps an existing seat subscription. A reservation is **not** a ticket until its status is `confirmed` after independent payment validation.
