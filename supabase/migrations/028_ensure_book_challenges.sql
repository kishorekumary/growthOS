-- Ensure book_challenges table exists (safe to run even if already applied)
CREATE TABLE IF NOT EXISTS public.book_challenges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_month  DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  book_title       TEXT NOT NULL,
  author           TEXT,
  genre            TEXT,
  total_chapters   INT NOT NULL DEFAULT 10,
  chapters_read    INT NOT NULL DEFAULT 0,
  ai_note          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, challenge_month)
);

ALTER TABLE public.book_challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'book_challenges' AND policyname = 'own data'
  ) THEN
    CREATE POLICY "own data" ON public.book_challenges
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure vision_image_url column exists on user_goals
ALTER TABLE public.user_goals ADD COLUMN IF NOT EXISTS vision_image_url TEXT;
