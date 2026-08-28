-- Who created the client record (set server-side from the signed-in user).
alter table clients add column if not exists created_by text;

comment on column clients.created_by is
  'Display name/id of the user who created this client record';
