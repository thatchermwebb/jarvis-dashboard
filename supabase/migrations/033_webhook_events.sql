-- Two payment webhook events for attribution software:
--   • payment.ltv       — every successful payment (lifetime value)
--   • payment.cash_30d  — a payment within 30 days of the client's first payment
-- The `event` column already exists (migration 032). This just updates the
-- default and migrates any endpoint created under the old single-event name.

alter table webhook_endpoints alter column event set default 'payment.ltv';

update webhook_endpoints set event = 'payment.ltv' where event = 'payment.succeeded';
