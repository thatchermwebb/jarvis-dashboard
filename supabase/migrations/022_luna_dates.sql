-- Luna tracker dates: when a client's ad was paused, and when their subscription
-- payment failed. "Overdue" is derived from luna_failed_at (set = overdue), so no
-- separate status column is needed.

alter table clients add column if not exists luna_paused_at date;   -- set when Luna → Paused
alter table clients add column if not exists luna_failed_at date;   -- set when subscription fails → Overdue
alter table clients add column if not exists luna_pause_type text;  -- 'client' | 'trial' (which kind of pause)
