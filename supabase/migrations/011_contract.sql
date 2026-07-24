-- Client contract lifecycle + term.
-- contract_status: proposed | sent | signed | over
-- Term is an explicit date range; payment count and total period value are
-- entered manually (billed amounts differ from monthly_retainer on split deals).
alter table clients add column if not exists contract_status text;
alter table clients add column if not exists contract_start date;
alter table clients add column if not exists contract_end date;
alter table clients add column if not exists contract_payment_count integer;
alter table clients add column if not exists contract_total_value numeric;

comment on column clients.contract_status is
  'Contract lifecycle: proposed | sent | signed | over';
comment on column clients.contract_total_value is
  'Total value of the contract period (manually entered — actual billed, not net retainer)';
