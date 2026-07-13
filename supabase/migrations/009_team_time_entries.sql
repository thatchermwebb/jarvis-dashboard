-- Team page: VA task & hours tracking for the Operational Excellence program.

CREATE TABLE IF NOT EXISTS team_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  va_id TEXT NOT NULL,                     -- 'wilson' | 'samuel'
  description TEXT,
  is_standard BOOLEAN DEFAULT FALSE,       -- counts toward KPI (Ads for Wilson, Onboarding for Samuel)
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,                 -- set only for fulfillment-seeded tasks; anchors team KPI + work-hours rule
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  running_since TIMESTAMPTZ,               -- start of the current running segment (null when paused/completed)
  accumulated_seconds INTEGER DEFAULT 0,   -- banked worked time across pause/resume
  status TEXT DEFAULT 'idle',              -- idle | running | paused | completed
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_team_entries_va ON team_time_entries (va_id, paid, created_at DESC);

CREATE TRIGGER team_entries_updated_at BEFORE UPDATE ON team_time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE team_time_entries DISABLE ROW LEVEL SECURITY;
