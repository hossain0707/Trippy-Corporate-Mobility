# Technical and operational risk register

| Risk | Severity | Evidence/status | Blocking action |
|---|---|---|---|
| Live bus/Hiace transport authorization in Dhaka | Critical | Not independently approved | Local counsel + relevant authority written classification |
| Seat concurrency and late payment reconciliation | Critical | DB constraint coded; integration not run here | Postgres stress/race tests, refund/reconciliation worker |
| Personal locations/driver privacy | High | Access filters coded; field validation incomplete | Threat model, retention policy, GPS authorization audit |
| Real OTP reliability and abuse | High | Adapter coded; provider not connected | SMS testing, edge rate limiting, MFA for staff |
| Operational safety and incident response | Critical | Support ticket UI only | Staffed dispatch, emergency response and driver vetting |
| Payments / chargebacks / refunds | Critical | Validation code coded; real merchant not tested | Merchant sandbox/live E2E; ledger/chargeback policy |
| Dependency and supply chain drift | High | Direct deps pinned; frontend lockfile committed, backend transitive locks and audit pending | Add Python transitive lock; scan dependencies and pin image digests |
| Infrastructure durability | Critical | Local Compose only | Managed host, isolated DB, monitoring, PITR and restore drills |
| Physical seat-map mismatch | High | Illustrative templates; admin verification present | Inspect every vehicle, exits and capacity in person |

**Decision rule:** The product may be demoed to teammates, but may not accept real rider payments until all critical blockers are formally resolved.
