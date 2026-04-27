-- ============================================================
-- 007_daily_practice.sql
-- One row per user: pledge, affirmations[], gratitude[]
-- ============================================================

CREATE TABLE public.daily_practice (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pledge        TEXT,
  affirmations  TEXT[] NOT NULL DEFAULT '{}',
  gratitude     TEXT[] NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_practice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.daily_practice
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
