-- Keep only references and expiry dates. Sensitive license scans belong in separately
-- encrypted private storage with restricted access and retention controls.
CREATE TABLE IF NOT EXISTS app.driver_compliance (
  driver_id uuid PRIMARY KEY REFERENCES app.users(id),
  license_reference text NOT NULL,
  license_expires_on date NOT NULL,
  approved_by uuid NOT NULL REFERENCES app.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(license_reference) BETWEEN 4 AND 80)
);
