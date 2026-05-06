CREATE TABLE IF NOT EXISTS mood_checkins (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checked_at  DATE    NOT NULL DEFAULT CURRENT_DATE,
  mood        SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy      SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 5),
  word        TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS mood_checkins_user_date
  ON mood_checkins(user_id, checked_at);

ALTER TABLE mood_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checkins"
  ON mood_checkins FOR ALL USING (auth.uid() = user_id);
