-- Lets users choose which goal categories (and whether Tasks at all) show
-- up in the "Your Day at a Glance" opening briefing popup.

CREATE TABLE public.briefing_settings (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_categories TEXT[]  NOT NULL DEFAULT ARRAY['fitness','finance','books','general','career'],
  show_tasks      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.briefing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.briefing_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
