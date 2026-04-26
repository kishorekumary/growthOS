-- Add category and frequency columns to personality_habits
ALTER TABLE public.personality_habits
  ADD COLUMN IF NOT EXISTS category  TEXT NOT NULL DEFAULT 'mindset'
    CHECK (category  IN ('mindset', 'social', 'productivity')),
  ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (frequency IN ('daily', 'weekly'));
