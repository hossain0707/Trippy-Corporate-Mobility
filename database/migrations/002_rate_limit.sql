-- Shared across FastAPI worker processes; limits are application throttles, not a WAF.
CREATE TABLE IF NOT EXISTS app.rate_limits (
  action text NOT NULL,
  key_hash text NOT NULL,
  bucket bigint NOT NULL,
  hit_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(action,key_hash,bucket)
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx ON app.rate_limits(created_at);
