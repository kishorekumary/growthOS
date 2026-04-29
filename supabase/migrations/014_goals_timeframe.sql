-- ============================================================
-- 014_goals_timeframe.sql
-- Add timeframe label to user_goals for week/month/year grouping
-- ============================================================

ALTER TABLE public.user_goals
  ADD COLUMN IF NOT EXISTS timeframe TEXT
    NOT NULL DEFAULT 'custom'
    CHECK (timeframe IN ('week', 'month', 'year', 'custom'));
