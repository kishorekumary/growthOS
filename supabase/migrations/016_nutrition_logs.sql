-- ============================================================
-- 016_nutrition_logs.sql
-- Calorie / macro tracking with per-meal logging
-- ============================================================

CREATE TABLE public.nutrition_logs (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  meal_type  TEXT          NOT NULL DEFAULT 'meal'
               CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  food_name  TEXT          NOT NULL,
  calories   INTEGER       NOT NULL DEFAULT 0,
  protein_g  NUMERIC(6,1)  NOT NULL DEFAULT 0,
  carbs_g    NUMERIC(6,1)  NOT NULL DEFAULT 0,
  fiber_g    NUMERIC(6,1)  NOT NULL DEFAULT 0,
  fat_g      NUMERIC(6,1)  NOT NULL DEFAULT 0,
  notes      TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data" ON public.nutrition_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per-user daily macro goals (upserted on first save)
CREATE TABLE public.nutrition_goals (
  user_id    UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calories   INTEGER NOT NULL DEFAULT 2000,
  protein_g  INTEGER NOT NULL DEFAULT 150,
  carbs_g    INTEGER NOT NULL DEFAULT 250,
  fiber_g    INTEGER NOT NULL DEFAULT 30,
  fat_g      INTEGER NOT NULL DEFAULT 65,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data" ON public.nutrition_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
