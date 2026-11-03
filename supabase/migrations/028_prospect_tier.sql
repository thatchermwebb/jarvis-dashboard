-- Prospect Tier (1/2/3): how bought-in a prospect is. Relevant during the
-- onboarding/trial phase; shown on the client profile (tucked away once active).

alter table clients add column if not exists prospect_tier smallint;  -- 1 | 2 | 3
