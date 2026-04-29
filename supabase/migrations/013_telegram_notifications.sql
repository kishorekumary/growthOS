-- ============================================================
-- 013_telegram_notifications.sql
-- Add Telegram bot reminder support to notification settings
-- ============================================================

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
