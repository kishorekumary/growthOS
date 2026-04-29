-- ============================================================
-- 015_focus_sequences.sql
-- Saved timer sequences for the Focus feature
-- ============================================================

CREATE TABLE public.focus_sequences (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  steps      JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.focus_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.focus_sequences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
