-- Non-emergency support and safety-incident reporting workflow.
CREATE TABLE IF NOT EXISTS app.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  service_id uuid REFERENCES app.services(id),
  category text NOT NULL CHECK(category IN ('safety','driver','payment','route','accessibility','other')),
  message text NOT NULL CHECK(length(message) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_open_idx ON app.support_tickets(status,created_at) WHERE status IN ('open','in_progress');
