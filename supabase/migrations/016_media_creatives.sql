-- Creative Library: the deck of master creatives (V300, cr2, sV3…) Thatcher
-- designs. The Explore/Exploit engine assigns one to each new work order.

create table if not exists media_creatives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  code text unique not null,                 -- V300, cr2, sV3 (canonical id)
  name text,                                 -- optional label
  notes text,                                -- template / clip direction
  status text not null default 'active',     -- active (assignable) | retired
  created_by text
);
create index if not exists media_creatives_status_idx on media_creatives(status);

-- The creative the engine picked for this work order (what Wilson should build).
alter table media_work_orders add column if not exists target_creative text;

-- Seed the library from creative codes already used on ads, so it reflects reality.
insert into media_creatives (code, status, created_by)
select distinct creative, 'active', 'backfill'
from media_ads
where creative is not null and creative <> ''
on conflict (code) do nothing;
