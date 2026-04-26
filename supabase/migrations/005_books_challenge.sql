-- Monthly book challenges
CREATE TABLE public.book_challenges (
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
CREATE POLICY "own data" ON public.book_challenges
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
