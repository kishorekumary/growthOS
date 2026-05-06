CREATE TABLE IF NOT EXISTS routines (
  id         UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID  REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT  NOT NULL,
  type       TEXT  NOT NULL DEFAULT 'morning' CHECK (type IN ('morning', 'evening', 'custom')),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routine_steps (
  id               UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id       UUID     REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
  user_id          UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title            TEXT     NOT NULL,
  duration_minutes SMALLINT DEFAULT 5,
  position         SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routine_completions (
  id               UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id       UUID  REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
  user_id          UUID  REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_date   DATE  NOT NULL DEFAULT CURRENT_DATE,
  steps_completed  JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS routine_completions_uniq
  ON routine_completions(user_id, routine_id, completed_date);

ALTER TABLE routines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own routines"
  ON routines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own routine_steps"
  ON routine_steps FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own routine_completions"
  ON routine_completions FOR ALL USING (auth.uid() = user_id);
