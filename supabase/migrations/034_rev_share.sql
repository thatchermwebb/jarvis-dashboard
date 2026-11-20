-- Rev-share payment type.
-- A rev_share payment/plan carries a customizable revenue-share percentage
-- (e.g. 15 = 15%) alongside the collected dollar amount. The percentage is
-- stored for the books, reporting, and attribution; `amount` stays the actual
-- dollars collected for that payment.

alter table payments
  add column if not exists rev_share_percent numeric;

alter table payment_schedules
  add column if not exists rev_share_percent numeric;
