-- "Call Back" bin for the Calls queue: a per-client flag that moves a call out
-- of the main list into a separate Call Backs view. Purely a visual filter —
-- dates, notes, and everything else stay the same.

alter table clients add column if not exists callback boolean default false;
