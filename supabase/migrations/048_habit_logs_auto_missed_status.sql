-- Distinguishes the nightly cron's silent "user never touched this habit"
-- backfill (auto_missed) from a user actively marking a habit as skipped
-- (missed) — isPerfectDay must not treat the former as "handled," or a
-- mostly-untouched day looks retroactively "perfect" once the cron runs.
ALTER TABLE public.habit_logs DROP CONSTRAINT IF EXISTS habit_logs_status_check;
ALTER TABLE public.habit_logs ADD CONSTRAINT habit_logs_status_check
  CHECK (status IN ('done', 'missed', 'auto_missed'));
