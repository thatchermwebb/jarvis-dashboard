-- Outbound webhooks.
-- CZA can notify external systems (Zapier, Make, a custom endpoint, GHL, etc.)
-- when something happens in the app. The first event is `payment.succeeded`,
-- fired whenever a client payment becomes paid / paid_late. Each row is one
-- subscribed endpoint; several may listen to the same event. An optional
-- `secret` signs the payload (HMAC-SHA256, sent as the X-CZA-Signature header)
-- so the receiver can verify the request really came from us.

create table if not exists webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  event       text not null default 'payment.succeeded',  -- which event this endpoint listens to
  url         text not null,                               -- https destination we POST to
  secret      text,                                        -- optional HMAC signing secret
  description text,                                         -- human label, e.g. "Zapier – new payment"
  enabled     boolean not null default true,
  -- Lightweight delivery health (last attempt), handy for debugging in the UI.
  last_status       integer,       -- HTTP status of the most recent delivery (null = never sent)
  last_delivered_at timestamptz,   -- when the most recent delivery was attempted
  last_error        text,          -- error message from the most recent failed delivery
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_webhook_endpoints_event_enabled
  on webhook_endpoints(event) where enabled;
