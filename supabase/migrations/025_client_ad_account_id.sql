-- Ad Account ID shown/edited in the "Advertising" section of the client profile.

alter table clients add column if not exists ad_account_id text;
