-- JARVIS per-user memory

CREATE TABLE IF NOT EXISTS jarvis_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT NOT NULL,             -- 'Diego' | 'Thatcher' | 'Trepp'
  content TEXT NOT NULL,
  category TEXT DEFAULT 'fact',      -- preference | fact | client | instruction
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_jarvis_memories_user ON jarvis_memories (user_id, active, created_at DESC);
ALTER TABLE jarvis_memories DISABLE ROW LEVEL SECURITY;
