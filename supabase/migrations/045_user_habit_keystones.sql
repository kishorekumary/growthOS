-- ============================================================
-- 045_user_habit_keystones.sql
-- Per-user overlay marking a GLOBAL habit as keystone for just
-- that user, without touching the shared personality_habits row.
--
-- Personal habits keep using personality_habits.is_keystone
-- (unchanged) — a shared row can't hold a per-user boolean, so
-- global habits get this instead. Same shape as habit_logs: a
-- shared habit definition row, with per-user state in its own
-- table keyed by (user_id, habit_id).
--
-- A row's existence means "this user marked this habit keystone
-- for themselves." Not DB-restricted to is_global habits — the
-- app only ever writes here for global ones.
-- ============================================================

CREATE TABLE public.user_habit_keystones (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID        NOT NULL REFERENCES public.personality_habits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, habit_id)
);

ALTER TABLE public.user_habit_keystones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own keystones" ON public.user_habit_keystones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
