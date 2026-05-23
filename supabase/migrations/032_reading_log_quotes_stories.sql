-- Add quotes and stories columns to reading_log
ALTER TABLE reading_log ADD COLUMN IF NOT EXISTS quotes  TEXT;
ALTER TABLE reading_log ADD COLUMN IF NOT EXISTS stories TEXT;
