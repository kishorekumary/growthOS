-- ============================================================
-- 051_journal_entries_title_tags.sql
-- journal_entries was first created by 001 without title/tags. 024's
-- CREATE TABLE IF NOT EXISTS was therefore a no-op on the live DB, so
-- every insert that sets title or tags (journal page, power questions)
-- fails with 42703 "column does not exist".
-- ============================================================

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS tags  TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.journal_entries ALTER COLUMN content SET DEFAULT '';

-- Power questions and reminders look up today's entry by tag.
CREATE INDEX IF NOT EXISTS journal_entries_tags
  ON public.journal_entries USING GIN (tags);
