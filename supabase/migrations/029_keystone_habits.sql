-- Add keystone flag to personality_habits (max 2 enforced in app layer)
ALTER TABLE public.personality_habits ADD COLUMN IF NOT EXISTS is_keystone BOOLEAN NOT NULL DEFAULT false;
