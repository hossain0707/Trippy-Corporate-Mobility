-- Demo checkout is purely illustrative: show real tariff mathematics without collecting money.
-- All historical records remain valid; default values mark legacy demo bookings.
ALTER TABLE app.demo_bookings
  ADD COLUMN IF NOT EXISTS estimated_base_amount_bdt integer NOT NULL DEFAULT 0
    CHECK (estimated_base_amount_bdt >= 0),
  ADD COLUMN IF NOT EXISTS discount_percent smallint NOT NULL DEFAULT 0
    CHECK (discount_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS estimated_total_bdt integer NOT NULL DEFAULT 0
    CHECK (estimated_total_bdt >= 0),
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'not_selected'
    CHECK (payment_method IN ('not_selected','bkash_demo','nagad_demo','card_demo','bank_demo')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_processed'
    CHECK (payment_status IN ('not_processed','simulated'));
COMMENT ON COLUMN app.demo_bookings.estimated_total_bdt IS
  'Illustrative fare, NOT money due or paid. Demo payments are never processed.';
COMMENT ON COLUMN app.demo_bookings.payment_method IS
  'Simulation choice only. No provider integration, payment credentials or financial transactions.';
COMMENT ON COLUMN app.demo_bookings.payment_status IS
  'Simulated means the user viewed a practice payment step. Never means actual paid.';
