-- Add logged_at time field to nutrition_logs for time-of-day tracking
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ;

-- Extend meal_type to include 'drink' for beverages (coffee, tea, juice etc.)
ALTER TABLE public.nutrition_logs
  DROP CONSTRAINT IF EXISTS nutrition_logs_meal_type_check;

ALTER TABLE public.nutrition_logs
  ADD CONSTRAINT nutrition_logs_meal_type_check
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'drink'));

-- Water intake tracking
CREATE TABLE IF NOT EXISTS public.water_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  amount_ml   INTEGER     NOT NULL CHECK (amount_ml > 0),
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own water data" ON public.water_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date
  ON public.water_logs (user_id, log_date);
