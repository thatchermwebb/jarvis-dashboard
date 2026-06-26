-- Payment schedules (recurring pay plans)
CREATE TABLE payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT,                        -- e.g. "Monthly Retainer", "Bi-weekly plan"
  payment_type TEXT NOT NULL,        -- retainer_monthly | retainer_biweekly | retainer_weekly | deposit | remaining_balance | one_time
  amount NUMERIC NOT NULL,
  frequency TEXT NOT NULL,           -- weekly | biweekly | monthly | one_time
  start_date DATE NOT NULL,
  end_date DATE,
  active BOOLEAN DEFAULT TRUE,
  notes TEXT
);

-- Individual payment entries (one per due date)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES payment_schedules(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | paid_late | overdue | waived
  notes TEXT
);

-- Auto-update updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payment_schedules_client_id ON payment_schedules(client_id);

-- Disable RLS for internal tool
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules DISABLE ROW LEVEL SECURITY;
