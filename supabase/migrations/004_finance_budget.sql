-- AI-generated budgets (latest per user)
CREATE TABLE public.budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data" ON public.budgets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
