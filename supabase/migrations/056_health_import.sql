-- 056_health_import.sql
-- Workouts and sleep imported from Samsung Health (via Android Health
-- Connect). `source` marks where a row came from (NULL = logged in the
-- app); `external_id` is Health Connect's record id, unique per user so a
-- re-sync updates instead of duplicating. NULLs never conflict, so manual
-- rows are unaffected.

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS source      TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_user_external_key
  ON public.workout_logs (user_id, external_id);

ALTER TABLE public.sleep_logs
  ADD COLUMN IF NOT EXISTS source      TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;
