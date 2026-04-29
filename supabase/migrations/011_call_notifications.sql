-- ============================================================
-- 011_call_notifications.sql
-- Add phone call reminder support to notification settings
-- ============================================================

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS call_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_number  TEXT;
