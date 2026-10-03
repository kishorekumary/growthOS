-- ============================================================
-- 050_habit_leverage_and_decisions.sql
--
-- habit_leverage: a user's own pain/pleasure reasons for a habit ("what
-- skipping this costs me" / "what doing it gives me"), shown on the Today
-- card and in the streak-at-risk notification. Its own per-user table
-- (not columns on personality_habits) because global habits are one row
-- shared by every user, and leverage is personal.
--
-- decisions: the decision log — a committed decision, the first action to
-- take within 24h, and check-ins at 1, 7 and 30 days.
--
-- Safe to re-run: every statement is IF NOT EXISTS / drop-then-create.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.habit_leverage (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID NOT NULL REFERENCES public.personality_habits(id) ON DELETE CASCADE,
  pain       TEXT,
  pleasure   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, habit_id)
);

ALTER TABLE public.habit_leverage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own habit leverage" ON public.habit_leverage;
CREATE POLICY "own habit leverage" ON public.habit_leverage
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statement     TEXT NOT NULL,
  first_action  TEXT NOT NULL,
  decided_on    DATE NOT NULL,
  action_taken  BOOLEAN,                                   -- day-1 check-in; NULL = not answered yet
  review_7      TEXT CHECK (review_7  IN ('kept', 'slipped')),
  review_30     TEXT CHECK (review_30 IN ('kept', 'slipped')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decisions_user_decided_on ON public.decisions (user_id, decided_on DESC);

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own decisions" ON public.decisions;
CREATE POLICY "own decisions" ON public.decisions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
