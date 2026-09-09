-- Track the creative code (e.g. V300, V500, v10, cr6, sV3) running in each slot,
-- replacing the CPL field in the weekly review. Stored on the ad and snapshotted
-- into each review for week-to-week history.

alter table media_ads add column if not exists creative text;

alter table media_reviews add column if not exists ad1_creative text;
alter table media_reviews add column if not exists ad2_creative text;
