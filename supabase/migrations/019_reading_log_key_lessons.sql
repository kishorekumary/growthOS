ALTER TABLE public.reading_log
  ADD COLUMN IF NOT EXISTS key_lessons TEXT;
