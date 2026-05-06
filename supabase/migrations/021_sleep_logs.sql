CREATE TABLE IF NOT EXISTS sleep_logs (
  id          UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sleep_date  DATE     NOT NULL,
  bedtime     TIME     NOT NULL,
  wake_time   TIME     NOT NULL,
  quality     SMALLINT CHECK (quality BETWEEN 1 AND 5),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sleep_logs_user_date
  ON sleep_logs(user_id, sleep_date);

ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sleep logs"
  ON sleep_logs FOR ALL USING (auth.uid() = user_id);
