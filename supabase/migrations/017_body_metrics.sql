-- ============================================================
-- 017_body_metrics.sql
-- Body stats (height/age/target) + weight log for BMI & graph
-- ============================================================

-- Static profile: height, age, target weight (upserted in-place)
CREATE TABLE public.body_stats (
  user_id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm        NUMERIC(5,1) NOT NULL DEFAULT 170,
  age              INTEGER      NOT NULL DEFAULT 25,
  target_weight_kg NUMERIC(5,1),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.body_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data" ON public.body_stats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- One weight entry per day; UNIQUE prevents duplicates
CREATE TABLE public.weight_logs (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
  weight_kg  NUMERIC(5,1) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data" ON public.weight_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
