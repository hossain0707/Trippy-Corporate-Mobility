# Runbook — Day-1 operational rules

- Before each shift: check all activated vehicles' fitness/insurance, driver credentials, approved stop accessibility, route changes and actual available capacity.
- If a bus/Hiace/car is full: open a demand request; verify a replacement or add a separate licensed vehicle/service. **Never** increase the DB count for the current physical vehicle.
- If a customer reports a safety concern: treat the submitted support record as a **ticket**, not a real-time emergency dispatch. Establish local emergency contact and a staffed dispatch phone before launch.
- If payment is validated after seat hold expiry or provider risk is high: the system queues a review, not a confirmed pass. Finance must independently reconcile merchant transaction, identify whether a seat can be safely reallocated, and apply an approved refund policy. Do not edit `confirmed` by hand.
- Payment callbacks are idempotent and logged by a SHA256 reference; an external browser return is never a payment proof.
- Expired holds are cleaned on the affected service/user during later booking attempts. Run a scheduled maintenance job in production to expire idle holds globally and clean old rate-limit and GPS rows.
- Backups: use managed PostgreSQL encrypted daily backups + PITR, test a restore in staging regularly, never keep demo fixtures in production.
- Admin access: bootstrap once, rotate/revoke staff privileges as employees leave, require MFA and out-of-band review for sensitive actions before launch.

Maintenance SQL is provided as **reviewable examples only**; coordinate with SRE and legal for actual retention periods. Location history is sensitive.
