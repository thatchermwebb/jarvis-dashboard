-- Media Buying: the weekly ad-optimization loop.
-- review (rate Ad 1 / Ad 2) → matrix decision → work orders → produce → launch (auto slot-swap).

-- The two active ad "slots" per client, plus retired creative history.
create table if not exists media_ads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  client_id uuid references clients(id) on delete cascade,
  slot smallint,                          -- 1 or 2 while active; null once retired
  name text,
  service_type text,                      -- interior | full | ceramic | ... (free text)
  price_point text,                       -- e.g. "$199"
  angle text,                             -- hook / angle
  video_link text,
  cpl numeric,                            -- latest cost-per-lead
  rating text,                            -- good | decent | bad (from last review)
  status text not null default 'active',  -- in_production | active | paused | retired
  work_order_id uuid,                     -- the order that produced it (nullable)
  launched_at timestamptz,
  retired_at timestamptz
);
create index if not exists media_ads_client_idx on media_ads(client_id);
create index if not exists media_ads_status_idx on media_ads(status);

-- Samuel's weekly per-client review + the auto-computed decision.
create table if not exists media_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  client_id uuid references clients(id) on delete cascade,
  week date not null,                     -- Monday of the review week
  reviewed_by text,
  reviewed_at timestamptz default now(),
  ad1_id uuid, ad1_rating text, ad1_cpl numeric,
  ad2_id uuid, ad2_rating text, ad2_cpl numeric,
  decision text,                          -- leave | spend_to_winner | spend_to_winner_order_1 | order_2
  winner_slot smallint,                   -- 1 | 2 (for spend_to_winner*)
  notes text,
  unique (client_id, week)
);
create index if not exists media_reviews_week_idx on media_reviews(week);

-- Wilson's production queue, generated from review decisions.
create table if not exists media_work_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  client_id uuid references clients(id) on delete cascade,
  review_id uuid references media_reviews(id) on delete set null,
  replaces_slot smallint,                 -- which active slot the new ad will fill (1|2)
  service_type text,
  price_point text,
  angle text,
  notes text,
  status text not null default 'todo',    -- todo | in_production | produced | uploaded | done
  produced_ad_id uuid,                    -- media_ads row created on launch
  produced_by text, produced_at timestamptz,
  video_link text,                        -- the finished creative
  uploaded_by text, uploaded_at timestamptz
);
create index if not exists media_work_orders_status_idx on media_work_orders(status);
