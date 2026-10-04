-- The creative/package a client is currently running, picked from the Creative
-- Library on the client profile. Centralized on the client so it stays consistent
-- everywhere the client is shown. (Ad spend already lives in clients.spend.)

alter table clients add column if not exists creative_package text;
