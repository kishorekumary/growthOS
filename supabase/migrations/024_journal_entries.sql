CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date  DATE     NOT NULL DEFAULT CURRENT_DATE,
  title       TEXT,
  content     TEXT     NOT NULL DEFAULT '',
  mood        SMALLINT CHECK (mood BETWEEN 1 AND 5),
  tags        TEXT[]   DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_entries_user_date
  ON journal_entries(user_id, entry_date DESC);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own journal entries"
  ON journal_entries FOR ALL USING (auth.uid() = user_id);
