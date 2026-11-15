-- Operational timetable and demand-review enhancements.
CREATE TABLE IF NOT EXISTS app.service_stop_times (
  service_id uuid NOT NULL REFERENCES app.services(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK(direction IN ('morning','evening')),
  stop_id uuid NOT NULL REFERENCES app.stops(id) ON DELETE RESTRICT,
  planned_arrival time NOT NULL,
  PRIMARY KEY(service_id,direction,stop_id)
);

-- Existing service records are unaffected. Newly scheduled trips need a complete
-- admin-approved timetable before activation (enforced by FastAPI activation).
CREATE INDEX IF NOT EXISTS service_stop_times_by_service
  ON app.service_stop_times(service_id,direction,planned_arrival);

ALTER TABLE app.demand_requests
  ADD COLUMN request_kind text NOT NULL DEFAULT 'new_route'
    CHECK (request_kind IN ('new_route','new_stop','more_seats')),
  ADD COLUMN preferred_morning_time time,
  ADD COLUMN preferred_evening_time time,
  ADD COLUMN notes text CHECK (notes IS NULL OR length(notes)<=500),
  ADD COLUMN resolution_note text CHECK (resolution_note IS NULL OR length(resolution_note)<=500),
  ADD COLUMN reviewed_by uuid REFERENCES app.users(id),
  ADD COLUMN reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS demand_grouping_index
  ON app.demand_requests (lower(trim(home_zone)), lower(trim(office_zone)), status);

REVOKE ALL ON app.service_stop_times FROM PUBLIC;
DO $roles$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    EXECUTE 'REVOKE ALL ON app.service_stop_times FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'REVOKE ALL ON app.service_stop_times FROM authenticated';
  END IF;
END $roles$;
