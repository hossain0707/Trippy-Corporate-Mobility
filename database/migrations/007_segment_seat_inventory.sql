-- TRIPPY corridor seat inventory, additive backfill before constraint replacement.
-- Passenger journeys are [pickup_order,dropoff_order) in each direction.
-- No empty or incomplete journey is allowed; reverse evening must also remain conflict-free.
ALTER TABLE app.reservations
  ADD COLUMN morning_segment int4range,
  ADD COLUMN evening_segment int4range;

UPDATE app.reservations b SET
  morning_segment=int4range(mp.stop_order,md.stop_order,'[)'),
  evening_segment=int4range(ed.stop_order,ep.stop_order,'[)')
FROM app.services sv
JOIN app.route_stops mp ON mp.direction='morning'
JOIN app.route_stops md ON md.direction='morning' AND md.route_id=mp.route_id
JOIN app.route_stops ep ON ep.direction='evening' AND ep.route_id=mp.route_id
JOIN app.route_stops ed ON ed.direction='evening' AND ed.route_id=mp.route_id
WHERE b.service_id=sv.id AND mp.route_id=sv.route_id
  AND mp.stop_id=b.pickup_stop_id AND md.stop_id=b.dropoff_stop_id
  AND ep.stop_id=b.pickup_stop_id AND ed.stop_id=b.dropoff_stop_id
  AND mp.stop_order<md.stop_order AND ed.stop_order<ep.stop_order;

DO $verify_old_bookings$
BEGIN
  IF EXISTS (SELECT 1 FROM app.reservations
             WHERE morning_segment IS NULL OR evening_segment IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate legacy reservations: some lack valid ordered morning/evening stop pairs';
  END IF;
END $verify_old_bookings$;

ALTER TABLE app.reservations
  ALTER COLUMN morning_segment SET NOT NULL,
  ALTER COLUMN evening_segment SET NOT NULL,
  ADD CONSTRAINT reservation_morning_segment_nonempty CHECK (
    NOT isempty(morning_segment) AND
    lower_inc(morning_segment) AND NOT upper_inc(morning_segment) AND
    NOT lower_inf(morning_segment) AND NOT upper_inf(morning_segment)
  ),
  ADD CONSTRAINT reservation_evening_segment_nonempty CHECK (
    NOT isempty(evening_segment) AND
    lower_inc(evening_segment) AND NOT upper_inc(evening_segment) AND
    NOT lower_inf(evening_segment) AND NOT upper_inf(evening_segment)
  );

-- Create both new constraints before dropping the coarse full-service exclusion.
-- Concurrent transactions cannot override these PostgreSQL GiST invariants.
ALTER TABLE app.reservations ADD CONSTRAINT no_morning_segment_double_booking
  EXCLUDE USING gist (
    seat_id WITH =,
    daterange(starts_on,ends_before,'[)') WITH &&,
    morning_segment WITH &&
  ) WHERE (status IN ('held','confirmed','payment_review'));

ALTER TABLE app.reservations ADD CONSTRAINT no_evening_segment_double_booking
  EXCLUDE USING gist (
    seat_id WITH =,
    daterange(starts_on,ends_before,'[)') WITH &&,
    evening_segment WITH &&
  ) WHERE (status IN ('held','confirmed','payment_review'));

ALTER TABLE app.reservations DROP CONSTRAINT no_seat_double_booking;

COMMENT ON COLUMN app.reservations.morning_segment IS
  'Reserved contiguous passenger travel legs on the ordered morning route, half-open [pickup,dropoff).';
COMMENT ON COLUMN app.reservations.evening_segment IS
  'Reserved return travel legs on the reverse evening route, half-open [office,home).';
