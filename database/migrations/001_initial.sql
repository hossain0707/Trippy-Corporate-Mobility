-- Trippy Corporate / PostgreSQL 16+ / private server-only schema
-- Apply with psql -v ON_ERROR_STOP=1 -f database/migrations/001_initial.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON SCHEMA app FROM anon'; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON SCHEMA app FROM authenticated'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  role text NOT NULL DEFAULT 'rider' CHECK(role IN('rider','driver','dispatcher','admin')),
  welcome_redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON app.users(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS app.stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  zone text NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  approved boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latitude BETWEEN -90 AND 90),
  CHECK (longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS stops_zone_idx ON app.stops(zone) WHERE active;

CREATE TABLE IF NOT EXISTS app.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class text NOT NULL CHECK(class IN('bus','hiace','car')),
  registration_no text NOT NULL UNIQUE,
  operator_name text NOT NULL,
  licensed_passenger_capacity integer NOT NULL CHECK(licensed_passenger_capacity BETWEEN 1 AND 60),
  documents_verified boolean NOT NULL DEFAULT false,
  seat_map_verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  fitness_expires_on date,
  insurance_expires_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only bookable, approved passenger seats belong here. Driver seat is never insertable.
-- Position coordinates are editable per ACTUAL vehicle; never infer from the vehicle class.
CREATE TABLE IF NOT EXISTS app.vehicle_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES app.vehicles(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK(length(label) BETWEEN 1 AND 12),
  row_no integer NOT NULL CHECK(row_no BETWEEN 0 AND 40),
  col_no integer NOT NULL CHECK(col_no BETWEEN 0 AND 8),
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE(vehicle_id,label),
  UNIQUE(vehicle_id,row_no,col_no),
  UNIQUE(vehicle_id,id)
);

CREATE TABLE IF NOT EXISTS app.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  home_zone text NOT NULL,
  office_zone text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(home_zone <> office_zone)
);

CREATE TABLE IF NOT EXISTS app.route_stops (
  route_id uuid NOT NULL REFERENCES app.routes(id) ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES app.stops(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK(direction IN('morning','evening')),
  stop_order integer NOT NULL CHECK(stop_order BETWEEN 0 AND 50),
  PRIMARY KEY(route_id,direction,stop_order),
  UNIQUE(route_id,direction,stop_id)
);

CREATE TABLE IF NOT EXISTS app.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  route_id uuid NOT NULL REFERENCES app.routes(id),
  vehicle_id uuid NOT NULL REFERENCES app.vehicles(id),
  morning_departure time NOT NULL,
  evening_departure time NOT NULL,
  -- ISO day numbers: 1=Monday .. 7=Sunday. Bangladesh schedules must be configured.
  operating_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,7]::smallint[],
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(array_length(operating_days,1) BETWEEN 1 AND 7)
);
CREATE INDEX IF NOT EXISTS services_routes_idx ON app.services(route_id) WHERE active;

CREATE TABLE IF NOT EXISTS app.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  service_id uuid NOT NULL REFERENCES app.services(id),
  seat_id uuid NOT NULL REFERENCES app.vehicle_seats(id),
  pickup_stop_id uuid NOT NULL REFERENCES app.stops(id),
  dropoff_stop_id uuid NOT NULL REFERENCES app.stops(id),
  starts_on date NOT NULL,
  ends_before date NOT NULL,
  months smallint NOT NULL CHECK(months IN (1,3,6,12)),
  base_amount_bdt integer NOT NULL CHECK(base_amount_bdt >= 0),
  discount_percent integer NOT NULL CHECK(discount_percent IN (0,20,25,30,35)),
  amount_bdt integer NOT NULL CHECK(amount_bdt >= 0),
  applies_welcome_offer boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'held' CHECK(status IN ('held','confirmed','expired','cancelled','payment_review','refunded')),
  hold_expires_at timestamptz,
  confirmed_at timestamptz,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_before > starts_on),
  UNIQUE(user_id,idempotency_key),
  CONSTRAINT no_seat_double_booking EXCLUDE USING gist (
    seat_id WITH =,
    daterange(starts_on,ends_before,'[)') WITH &&
  ) WHERE(status IN ('held','confirmed','payment_review')),
  CONSTRAINT no_user_duplicate_service_booking EXCLUDE USING gist (
    service_id WITH =,
    user_id WITH =,
    daterange(starts_on,ends_before,'[)') WITH &&
  ) WHERE(status IN ('held','confirmed','payment_review'))
);
-- Prevent parallel welcome-promo checkout attempts across different services.
CREATE UNIQUE INDEX IF NOT EXISTS one_unredeemed_welcome_hold ON app.reservations(user_id)
  WHERE applies_welcome_offer AND status IN ('held','confirmed','payment_review');
CREATE INDEX IF NOT EXISTS reservations_held_expiry_idx ON app.reservations(hold_expires_at) WHERE status='held';
CREATE INDEX IF NOT EXISTS reservations_users_idx ON app.reservations(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS app.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES app.reservations(id),
  merchant_tran_id text NOT NULL UNIQUE,
  gateway text NOT NULL DEFAULT 'sslcommerz',
  amount_bdt integer NOT NULL CHECK(amount_bdt > 0),
  gateway_session_id text,
  gateway_validation_id text UNIQUE,
  checkout_url text,
  status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','initiated','verified','failed','review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  UNIQUE(reservation_id,merchant_tran_id)
);

CREATE TABLE IF NOT EXISTS app.payment_notifications (
  id bigserial PRIMARY KEY,
  attempt_id uuid REFERENCES app.payment_attempts(id),
  payload_sha256 text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id,payload_sha256)
);

CREATE TABLE IF NOT EXISTS app.demand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  service_id uuid REFERENCES app.services(id),
  home_zone text NOT NULL,
  office_zone text NOT NULL,
  preferred_class text CHECK(preferred_class IN('bus','hiace','car')),
  status text NOT NULL DEFAULT 'open' CHECK(status IN('open','contacted','offered','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demand_open_idx ON app.demand_requests(created_at) WHERE status='open';

CREATE TABLE IF NOT EXISTS app.driver_assignments (
  service_id uuid NOT NULL REFERENCES app.services(id),
  driver_id uuid NOT NULL REFERENCES app.users(id),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(service_id,driver_id)
);
CREATE TABLE IF NOT EXISTS app.vehicle_locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id uuid NOT NULL REFERENCES app.services(id),
  driver_id uuid NOT NULL REFERENCES app.users(id),
  latitude numeric(9,6) NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  accuracy_m numeric(8,2) CHECK(accuracy_m BETWEEN 0 AND 2000),
  measured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_locations_latest_idx ON app.vehicle_locations(service_id,measured_at DESC);

CREATE TABLE IF NOT EXISTS app.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES app.users(id),
  action text NOT NULL,
  target_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_time_idx ON app.audit_events(at DESC);

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- Each physical vehicle is scheduled on at most one active recurring service.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_service_per_vehicle ON app.services(vehicle_id) WHERE active;
