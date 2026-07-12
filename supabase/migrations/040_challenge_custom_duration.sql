-- ============================================================
-- 040_challenge_custom_duration.sql
-- Allow challenges to run for a custom number of days, not just 90
-- ============================================================

ALTER TABLE public.ninety_day_challenges
  ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 90 CHECK (duration_days > 0);
