-- Accurate churn timing.
--
-- Until now the Reports "Churn — Clients Lost / Paused" metric bucketed clients
-- by updated_at (the row's last-edited timestamp). Any bulk edit therefore made
-- dozens of long-churned clients look like they all churned on the edit day, and
-- inflated "churned in the last 30 days" to essentially every churned client in
-- the book. churned_at fixes that: it is stamped once, the moment a client
-- actually transitions into churned/paused (see app/api/clients/[id]/route.ts),
-- and is what Reports now buckets on.

alter table clients add column if not exists churned_at timestamptz;

-- One-time backfill for clients already churned/paused. Best available signal
-- for WHEN they were actually marked churned/paused, in priority order:
--   1. when their future invoices were voided — voiding future payments is the
--      mechanical action taken when a client churns, so the most recent voided
--      payment's updated_at is the churn moment (covers ~90% of churned clients)
--   2. the date of their last received payment (paid / paid_late)
--   3. signed_at  (converted, but no recorded payment)
--   4. created_at (last resort)
update clients c
set churned_at = coalesce(
  (
    select max(p.updated_at)
    from payments p
    where p.client_id = c.id and p.status = 'voided'
  ),
  (
    select max(p.paid_date)::timestamptz
    from payments p
    where p.client_id = c.id
      and p.status in ('paid', 'paid_late')
      and p.paid_date is not null
  ),
  c.signed_at,
  c.created_at
)
where c.stage in ('churned', 'paused')
  and c.churned_at is null;
