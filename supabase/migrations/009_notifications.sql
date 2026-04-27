-- ============================================================
-- 009_notifications.sql
-- Notification settings + push subscriptions per user
-- ============================================================

CREATE TABLE public.notification_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_time_1      TEXT NOT NULL DEFAULT '08:00', -- HH:MM in user's local timezone
  reminder_time_2      TEXT NOT NULL DEFAULT '18:00',
  timezone             TEXT NOT NULL DEFAULT 'UTC',   -- IANA timezone string
  last_reminder_1_sent DATE,                          -- prevents duplicate sends per day
  last_reminder_2_sent DATE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.notification_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- One subscription row per device/browser (endpoint is unique)
CREATE TABLE public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth_key   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
