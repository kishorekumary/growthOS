-- ============================================================
-- 010_flexible_reminders.sql
-- Replace fixed two-slot reminders with a flexible time array.
-- Dedup tracking moves from two DATE columns to a JSONB map
-- so any number of reminder times can be tracked per day.
-- ============================================================

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS reminder_times TEXT[]    NOT NULL DEFAULT ARRAY['08:00', '18:00'],
  ADD COLUMN IF NOT EXISTS sent_today     JSONB     NOT NULL DEFAULT '{}';

-- Seed reminder_times from existing rows that are still at defaults
UPDATE public.notification_settings
SET reminder_times = ARRAY[reminder_time_1, reminder_time_2]
WHERE reminder_times = ARRAY['08:00', '18:00'];
