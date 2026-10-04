-- Luna: clients whose ad-spend we pay and who pay us a recurring subscription
-- for it. The "Running in Luna" toggle on the client profile flags them; the
-- Luna tracker page lists only flagged clients and tracks their ad/sub/payment.

alter table clients add column if not exists running_in_luna boolean default false;
alter table clients add column if not exists luna_live boolean default false;
alter table clients add column if not exists luna_subscription_sent boolean default false;
alter table clients add column if not exists luna_payment_amount numeric;
alter table clients add column if not exists luna_payment_frequency text;  -- 'day' | 'week' | 'month'

create index if not exists clients_running_in_luna_idx on clients(running_in_luna) where running_in_luna;
