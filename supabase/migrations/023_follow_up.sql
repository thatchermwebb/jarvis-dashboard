-- "Follow Ups" bin for unreachable / ghosting clients & trials. Like Call Backs /
-- Stalled Onboarding: a per-client flag that pulls the call into its own bin.
-- follow_up_since starts a day-tracker (how many days you've been trying to
-- reach them); after ~7-10 days with no contact they're considered lost.

alter table clients add column if not exists follow_up boolean default false;
alter table clients add column if not exists follow_up_since date;
