-- Add signed_at: set once when client first moves to active_client stage.
-- Unlike updated_at (which fires on every row change), this never changes
-- after first conversion, so it's a reliable "deal closed" timestamp.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- Backfill existing active clients:
-- 1. Use trial_end if present (best proxy — that's when the trial converted)
-- 2. Fall back to created_at
UPDATE clients
SET signed_at = CASE
  WHEN trial_end IS NOT NULL THEN (trial_end::DATE)::TIMESTAMPTZ
  ELSE created_at
END
WHERE stage = 'active_client' AND signed_at IS NULL;

-- Trigger: set signed_at only on the first transition into active_client
CREATE OR REPLACE FUNCTION set_signed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'active_client'
     AND (OLD.stage IS DISTINCT FROM 'active_client')
     AND NEW.signed_at IS NULL
  THEN
    NEW.signed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_signed_at ON clients;
CREATE TRIGGER clients_signed_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_signed_at();
