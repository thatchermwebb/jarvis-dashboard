-- Trepp Needed flag + AI situation summary cache

ALTER TABLE clients ADD COLUMN IF NOT EXISTS trepp_needed BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_situation_summary TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ;
