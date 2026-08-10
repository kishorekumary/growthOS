-- ============================================================
-- 046_user_hidden_habits.sql
-- Per-user overlay hiding a GLOBAL habit from just that user's
-- tracker, without touching the shared personality_habits row
-- or affecting any other user.
--
-- Same shape as user_habit_keystones (045): a shared habit
-- definition row, with per-user state in its own table keyed
-- by (user_id, habit_id).
--
-- A row's existence means "this user has hidden this habit for
-- themselves." Not DB-restricted to is_global habits — the app
-- only ever writes here for global ones (personal habits are
-- deleted outright by their owner instead).
-- ============================================================

CREATE TABLE public.user_hidden_habits (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID        NOT NULL REFERENCES public.personality_habits(id) ON DELETE CASCADE,
  hidden_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, habit_id)
);

ALTER TABLE public.user_hidden_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own hidden habits" ON public.user_hidden_habits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
