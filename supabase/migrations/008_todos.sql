-- ============================================================
-- 008_todos.sql
-- User todos with optional due date and notes
-- ============================================================

CREATE TABLE public.user_todos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  notes         TEXT,
  due_date      DATE,
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.user_todos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_todos_user_id_idx ON public.user_todos (user_id);
CREATE INDEX user_todos_due_date_idx ON public.user_todos (user_id, due_date);
