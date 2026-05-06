-- Main challenge record
CREATE TABLE IF NOT EXISTS ninety_day_challenges (
  id                UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title             TEXT     NOT NULL,
  description       TEXT,
  category          TEXT     NOT NULL DEFAULT 'personal',
  start_date        DATE     NOT NULL,
  daily_commitment  TEXT,
  why_matters       TEXT,
  status            TEXT     NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS challenges_user
  ON ninety_day_challenges(user_id, created_at DESC);

ALTER TABLE ninety_day_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own challenges"
  ON ninety_day_challenges FOR ALL USING (auth.uid() = user_id);

-- Per-day check-ins
CREATE TABLE IF NOT EXISTS challenge_checkins (
  id            UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id  UUID     REFERENCES ninety_day_challenges(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checkin_date  DATE     NOT NULL,
  completed     BOOLEAN  NOT NULL DEFAULT true,
  reflection    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS challenge_checkins_unique
  ON challenge_checkins(challenge_id, checkin_date);

ALTER TABLE challenge_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own challenge checkins"
  ON challenge_checkins FOR ALL USING (auth.uid() = user_id);

-- AI milestone messages (cached per challenge per milestone day)
CREATE TABLE IF NOT EXISTS challenge_milestones (
  id            UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id  UUID     REFERENCES ninety_day_challenges(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day_number    INTEGER  NOT NULL,
  message       TEXT     NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS challenge_milestones_unique
  ON challenge_milestones(challenge_id, day_number);

ALTER TABLE challenge_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own challenge milestones"
  ON challenge_milestones FOR ALL USING (auth.uid() = user_id);
