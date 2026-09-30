-- Monthly Ad Update: which creatives (library codes like V300, cr2) each
-- client is running / getting this month.

alter table media_monthly_updates add column if not exists creatives text[] not null default '{}';
