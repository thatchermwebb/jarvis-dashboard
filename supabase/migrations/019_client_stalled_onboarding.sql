-- "Stalled Onboarding" bin for the Calls queue: a per-client flag (like
-- callback) that moves a call out of the main list into a separate Stalled
-- Onboarding view. Purely a visual filter — dates, notes, etc. stay the same.

alter table clients add column if not exists stalled_onboarding boolean default false;
