-- Citywide transport simulation: never mix with approved fleet or paid reservations.
-- Private app schema is server-only; no grants to anon/authenticated.
CREATE TABLE IF NOT EXISTS app.demo_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES app.vehicles(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK(length(name) BETWEEN 4 AND 80 AND position('demo' in lower(name)) > 0),
  city text NOT NULL DEFAULT 'Dhaka' CHECK(city = 'Dhaka'),
  is_published boolean NOT NULL DEFAULT true,
  removed_at timestamptz,
  created_by uuid NOT NULL REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(NOT (is_published AND removed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS demo_service_one_current_per_vehicle
  ON app.demo_services(vehicle_id) WHERE removed_at IS NULL;
CREATE TABLE IF NOT EXISTS app.demo_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES app.demo_services(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  seat_id uuid NOT NULL REFERENCES app.vehicle_seats(id) ON DELETE RESTRICT,
  pickup_zone text NOT NULL CHECK(length(trim(pickup_zone)) BETWEEN 2 AND 100),
  office_zone text NOT NULL CHECK(length(trim(office_zone)) BETWEEN 2 AND 100),
  starts_on date NOT NULL,
  ends_before date NOT NULL,
  months smallint NOT NULL CHECK(months IN (1,3,6,12)),
  status text NOT NULL DEFAULT 'demo_booked' CHECK(status IN ('demo_booked','demo_cancelled')),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_before>starts_on),
  CHECK(lower(trim(pickup_zone))<>lower(trim(office_zone))),
  UNIQUE(user_id,idempotency_key),
  CONSTRAINT demo_bookings_seat_no_overlap EXCLUDE USING gist (
    service_id WITH =, seat_id WITH =, daterange(starts_on,ends_before,'[)') WITH &&
  ) WHERE (status='demo_booked'),
  CONSTRAINT demo_bookings_one_seat_per_customer EXCLUDE USING gist (
    service_id WITH =, user_id WITH =, daterange(starts_on,ends_before,'[)') WITH &&
  ) WHERE (status='demo_booked')
);
CREATE INDEX IF NOT EXISTS demo_bookings_customer_history
  ON app.demo_bookings(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS demo_bookings_service_history
  ON app.demo_bookings(service_id,created_at DESC);
REVOKE ALL ON app.demo_services,app.demo_bookings FROM PUBLIC;
REVOKE ALL ON app.demo_services,app.demo_bookings FROM anon,authenticated;
