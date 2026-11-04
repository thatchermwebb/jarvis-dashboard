-- Affiliate commission tracking.
-- Each affiliate earns a commission equal to `commission_rate` percent of every
-- payment collected from their clients. Commissions are DERIVED from the
-- payments ledger; the only state we persist is whether a given commission has
-- been paid out to the affiliate. A row in affiliate_commission_payouts means
-- "the commission on this payment has been paid"; no row means it's still owed.

alter table affiliates
  add column if not exists commission_rate numeric not null default 10;  -- percent, e.g. 10 = 10%

create table if not exists affiliate_commission_payouts (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references payments(id) on delete cascade,
  paid_date   date not null default (now() at time zone 'utc')::date,
  marked_by   text,
  created_at  timestamptz default now(),
  unique (payment_id)
);

create index if not exists idx_commission_payouts_payment on affiliate_commission_payouts(payment_id);
