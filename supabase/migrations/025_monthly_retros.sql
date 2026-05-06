CREATE TABLE IF NOT EXISTS monthly_retros (
  id          UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_start DATE     NOT NULL,
  content     JSONB    NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_retros_user_month
  ON monthly_retros(user_id, month_start);

ALTER TABLE monthly_retros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own monthly retros"
  ON monthly_retros FOR ALL USING (auth.uid() = user_id);
