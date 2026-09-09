-- Link a VA team-queue entry back to the media-buying work order that spawned it,
-- so Wilson can start ad production from his Team tab and completing it advances
-- the work order (todo → in_production → produced) automatically.

alter table team_time_entries add column if not exists work_order_id uuid;
create index if not exists team_time_entries_work_order_idx on team_time_entries(work_order_id);
