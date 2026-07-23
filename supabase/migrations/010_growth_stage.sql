-- Client growth stage: where the owner is in their business journey.
-- launching = solo, hasn't hired before (usually 0–10k)
-- hiring    = hiring for the first time (usually 8–15k)
-- scaling   = been there, done that, doing it (usually 15k+)
alter table clients add column if not exists growth_stage text;

comment on column clients.growth_stage is
  'Owner business journey tag: launching | hiring | scaling';
