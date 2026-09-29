-- Monthly Ad Update: one page per month listing every client and the creatives
-- they're running, with a per-client status (blank → Ads Produced → Completed).

create table if not exists media_monthly_pages (
  month text primary key,                  -- 'YYYY-MM'
  created_at timestamptz default now(),
  created_by text
);

create table if not exists media_monthly_updates (
  id uuid primary key default gen_random_uuid(),
  month text not null references media_monthly_pages(month) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  status text,                             -- null (blank) | ads_produced | completed
  updated_by text,
  updated_at timestamptz default now(),
  unique (month, client_id)
);
create index if not exists media_monthly_updates_month_idx on media_monthly_updates(month);

insert into media_monthly_pages (month, created_by) values ('2026-10', 'seed')
on conflict (month) do nothing;
