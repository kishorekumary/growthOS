-- ============================================================
-- 018_goals_career_category.sql
-- Add 'career' as a valid category for user_goals
-- ============================================================

ALTER TABLE public.user_goals
  DROP CONSTRAINT IF EXISTS user_goals_category_check;

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_category_check
    CHECK (category IN ('fitness', 'finance', 'books', 'general', 'career'));
