CREATE TABLE IF NOT EXISTS app.subscription_pricing (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  bus integer NOT NULL CHECK (bus BETWEEN 1 AND 1000000),
  hiace integer NOT NULL CHECK (hiace BETWEEN 1 AND 1000000),
  car integer NOT NULL CHECK (car BETWEEN 1 AND 1000000),
  first_month integer NOT NULL CHECK (first_month BETWEEN 0 AND 99),
  three_months integer NOT NULL CHECK (three_months BETWEEN 0 AND 99),
  six_months integer NOT NULL CHECK (six_months BETWEEN 0 AND 99),
  twelve_months integer NOT NULL CHECK (twelve_months BETWEEN 0 AND 99),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  CHECK (least(bus, hiace, car) * (100 - greatest(first_month, three_months, six_months, twelve_months)) >= 100)
);
ALTER TABLE app.subscription_pricing ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON app.subscription_pricing FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON app.subscription_pricing FROM authenticated;
  END IF;
END $$;
INSERT INTO app.subscription_pricing
  (bus, hiace, car, first_month, three_months, six_months, twelve_months)
VALUES (5000, 6500, 8000, 20, 25, 30, 35)
ON CONFLICT (singleton) DO NOTHING;
