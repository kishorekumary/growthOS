-- ============================================================
-- 012_habit_logs.sql
-- Per-day done/missed log for each habit.
-- Used for weekly score and missed tracking.
-- ============================================================

CREATE TABLE public.habit_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID        NOT NULL REFERENCES personality_habits(id) ON DELETE CASCADE,
  log_date   DATE        NOT NULL,
  status     TEXT        NOT NULL CHECK (status IN ('done', 'missed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (habit_id, log_date)
);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.habit_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
