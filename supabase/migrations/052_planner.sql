-- ============================================================
-- 052_planner.sql
-- Planner: day / week / month checklists with optional repeats.
-- Replaces user_todos (copied over below; user_todos is kept for
-- now and dropped in a later migration once verified).
-- Weeks start on Sunday.
-- ============================================================

CREATE TABLE public.planner_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  notes           TEXT,
  period_type     TEXT NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
  period_start    DATE NOT NULL,
  repeats         BOOLEAN NOT NULL DEFAULT FALSE,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  points_awarded  INT NOT NULL DEFAULT 0,
  carry_count     INT NOT NULL DEFAULT 0,
  ended_at        TIMESTAMPTZ,
  sort_order      INT NOT NULL DEFAULT 0,
  legacy_todo_id  UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planner_items_period_aligned CHECK (
    period_type = 'day'
    OR (period_type = 'week'  AND EXTRACT(DOW FROM period_start) = 0)
    OR (period_type = 'month' AND EXTRACT(DAY FROM period_start) = 1)
  )
);

ALTER TABLE public.planner_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.planner_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX planner_items_period_idx ON public.planner_items (user_id, period_type, period_start);
CREATE INDEX planner_items_open_idx   ON public.planner_items (user_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX planner_items_legacy_todo_idx
  ON public.planner_items (legacy_todo_id) WHERE legacy_todo_id IS NOT NULL;

CREATE TABLE public.planner_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES public.planner_items(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  points_awarded  INT NOT NULL DEFAULT 0,
  UNIQUE (item_id, period_start)
);

ALTER TABLE public.planner_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.planner_completions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX planner_completions_user_period_idx ON public.planner_completions (user_id, period_start);

-- ── Copy existing tasks ──────────────────────────────────────
-- Dated → day item on that date. Undated → week item for the current week.
-- Completed rows keep the points the old Tasks feature granted
-- (10, +5 if completed on/before the due date) so unchecking reverses them.
INSERT INTO public.planner_items (
  user_id, title, notes, period_type, period_start,
  is_completed, completed_at, points_awarded, legacy_todo_id, created_at, updated_at
)
SELECT
  t.user_id,
  t.title,
  t.notes,
  CASE WHEN t.due_date IS NULL THEN 'week' ELSE 'day' END,
  COALESCE(t.due_date, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT),
  t.is_completed,
  t.completed_at,
  CASE WHEN t.is_completed THEN
    10 + CASE WHEN t.due_date IS NOT NULL AND t.completed_at IS NOT NULL
                   AND t.completed_at::DATE <= t.due_date THEN 5 ELSE 0 END
  ELSE 0 END,
  t.id,
  t.created_at,
  t.updated_at
FROM public.user_todos t
WHERE NOT EXISTS (
  SELECT 1 FROM public.planner_items p WHERE p.legacy_todo_id = t.id
);
