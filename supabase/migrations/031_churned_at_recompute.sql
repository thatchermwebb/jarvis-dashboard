-- Recompute churned_at from the real churn action.
--
-- 030's first pass backfilled churned_at from each client's LAST PAID date. That
-- is wrong for anyone marked churned/paused a while after their last payment —
-- e.g. David's Precision Detailing last paid Oct 18 but was paused Nov 3, so the
-- Reports churn chart plotted him on Oct 18.
--
-- The accurate signal is when their future invoices were VOIDED (voiding future
-- payments is the action taken when a client churns). This re-derives churned_at
-- for every churned/paused client, overwriting the earlier value. Going forward,
-- churned_at is stamped directly on the stage change (app/api/clients/[id]).
--
-- Safe to run more than once (idempotent — it recomputes from source each time).

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
where c.stage in ('churned', 'paused');
