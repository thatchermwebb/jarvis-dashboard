-- Luna tracker: a per-client Luna account status (active | overdue), separate
-- from the client's lifecycle stage. Live/Pause is tracked by luna_live.

alter table clients add column if not exists luna_status text default 'active';  -- 'active' | 'overdue'
