-- Media Buying "Account Review" log: a periodic, structured deep-review of a
-- client's ad account. Replaces the old single free-text note with premade
-- fields (results for a timeframe) + a verdict/changes + a follow-up date. The
-- main Media Buying page rotates accounts by their follow-up date so the ones
-- due (or never reviewed) surface to the top.

create table if not exists media_account_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  created_by text,
  client_id uuid not null references clients(id) on delete cascade,
  -- Timeframe the results below cover.
  period_start date,
  period_end date,
  -- Results within that window.
  creatives text,                 -- which creatives were running (e.g. "cr1, cr2, cr3")
  leads integer,
  cpl numeric,                    -- cost per lead
  numbers_submitted integer,      -- phone numbers submitted
  booked integer,                 -- appointments booked
  spend numeric,
  revenue numeric,                -- value generated (e.g. GHL booked value)
  -- Qualitative.
  situation text,                 -- what's going on / observations
  verdict text,                   -- the call / assessment
  changes text,                   -- changes made or to make
  follow_up_date date             -- when to next take a look
);
create index if not exists media_account_logs_client_idx on media_account_logs(client_id);
create index if not exists media_account_logs_followup_idx on media_account_logs(follow_up_date);
