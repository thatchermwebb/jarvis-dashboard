-- Tasks: add due_time (priority + assigned_va exist in 001 but verify).
-- Live schema has drifted from migrations (title/assigned_to were added directly),
-- so everything here is IF NOT EXISTS.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time time;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_va text;
