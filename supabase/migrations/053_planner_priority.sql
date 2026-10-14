-- ============================================================
-- 053_planner_priority.sql
-- Optional priority on planner items (NULL = no priority).
-- ============================================================

ALTER TABLE public.planner_items
  ADD COLUMN IF NOT EXISTS priority TEXT
  CHECK (priority IN ('high', 'medium', 'low'));
