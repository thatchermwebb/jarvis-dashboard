-- JARVIS Command Center — Initial Schema

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Core
  name TEXT NOT NULL,
  business_name TEXT,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  market_location TEXT,
  timezone TEXT,
  stage TEXT NOT NULL DEFAULT 'onboarding',
  assigned_owner TEXT,
  assigned_va TEXT,
  assigned_closer TEXT,
  monthly_retainer NUMERIC,
  payment_frequency TEXT,
  payment_status TEXT DEFAULT 'current',
  deal_notes TEXT,

  -- Trial
  trial_start DATE,
  trial_end DATE,
  trial_health_score INTEGER,
  close_probability INTEGER,
  close_call_booked BOOLEAN DEFAULT FALSE,
  trial_outcome TEXT,
  trial_lost_reason TEXT,

  -- Communication
  last_contact_date TIMESTAMPTZ,
  last_contact_method TEXT,
  last_call_outcome TEXT,
  last_call_summary TEXT,
  last_client_sentiment TEXT,
  next_followup_date DATE,
  followup_reason TEXT,
  suggested_message TEXT,
  promises_made TEXT,
  objections TEXT,
  client_concerns TEXT,

  -- Ads (manual Phase 1)
  ad_status TEXT,
  new_ads BOOLEAN DEFAULT FALSE,
  campaign_link TEXT,
  ad_account_link TEXT,
  budget NUMERIC,
  spend NUMERIC,
  leads INTEGER DEFAULT 0,
  cpl NUMERIC,
  bookings INTEGER DEFAULT 0,
  cost_per_booking NUMERIC,
  best_ad TEXT,
  worst_ad TEXT,
  creative_status TEXT,
  location_targeting TEXT,
  last_ad_change DATE,
  next_ad_action TEXT,

  -- AI/CRM (manual Phase 1)
  ghl_location_link TEXT,
  ai_status TEXT,
  avg_ai_response_time TEXT,
  phone_numbers_collected INTEGER DEFAULT 0,
  vehicle_info_collected BOOLEAN DEFAULT FALSE,
  area_collected BOOLEAN DEFAULT FALSE,
  conversations_needing_human INTEGER DEFAULT 0,
  missed_conversations INTEGER DEFAULT 0,
  booking_rate NUMERIC,
  crm_issue BOOLEAN DEFAULT FALSE,

  -- Risk
  churn_risk_score INTEGER,
  risk_reason TEXT,
  save_action TEXT,
  thatcher_needed BOOLEAN DEFAULT FALSE,
  va_needed BOOLEAN DEFAULT FALSE,
  payment_issue BOOLEAN DEFAULT FALSE,
  urgency_level TEXT DEFAULT 'low',

  -- Links
  slack_thread TEXT,
  google_drive_folder TEXT
);

CREATE TABLE communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  log_type TEXT,
  outcome TEXT,
  summary TEXT,
  sentiment TEXT,
  promises_made TEXT,
  objections TEXT,
  next_step TEXT,
  followup_date DATE,
  created_by TEXT
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  task_type TEXT,
  priority TEXT DEFAULT 'medium',
  assigned_va TEXT,
  due_date DATE,
  status TEXT DEFAULT 'open',
  slack_sent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  asset_links TEXT
);

CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT,
  description TEXT,
  created_by TEXT,
  metadata JSONB
);

CREATE TABLE close_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  trial_dates TEXT,
  results_summary TEXT,
  client_mood TEXT,
  main_pain TEXT,
  best_closing_angle TEXT,
  potential_objection TEXT,
  recommended_offer TEXT,
  diego_notes TEXT,
  generated_content JSONB
);

-- Auto-update updated_at on clients
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes for common queries
CREATE INDEX idx_clients_stage ON clients(stage);
CREATE INDEX idx_clients_next_followup ON clients(next_followup_date);
CREATE INDEX idx_clients_trial_end ON clients(trial_end);
CREATE INDEX idx_clients_payment_issue ON clients(payment_issue) WHERE payment_issue = TRUE;
CREATE INDEX idx_clients_thatcher_needed ON clients(thatcher_needed) WHERE thatcher_needed = TRUE;
CREATE INDEX idx_communication_logs_client ON communication_logs(client_id, created_at DESC);
CREATE INDEX idx_tasks_client ON tasks(client_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_timeline_client ON timeline_events(client_id, created_at DESC);
