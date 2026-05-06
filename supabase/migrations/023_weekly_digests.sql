CREATE TABLE IF NOT EXISTS weekly_digests (
  id         UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID  REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE  NOT NULL,
  content    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_digests_user_week
  ON weekly_digests(user_id, week_start);

ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own digests"
  ON weekly_digests FOR ALL USING (auth.uid() = user_id);
