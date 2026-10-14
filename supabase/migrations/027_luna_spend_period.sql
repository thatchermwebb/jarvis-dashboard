-- Ad-spend subscription period for Luna clients: start/end dates for the current
-- ad-spend cycle, shown on the client profile (days-left + due emblem, like the
-- trial). The end date is when the ad-spend subscription is due to renew.

alter table clients add column if not exists luna_spend_start date;
alter table clients add column if not exists luna_spend_end date;
