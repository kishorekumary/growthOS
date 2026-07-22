-- Replace the habit category taxonomy (mindset/social/productivity) with
-- (health/wealth/leadership/social/family). Best-effort mapping for existing
-- rows: mindset -> leadership, productivity -> wealth, social unchanged.

-- Drop the old constraint first — the backfill below writes category values
-- (leadership, wealth) that the old constraint doesn't permit.
ALTER TABLE public.personality_habits
  DROP CONSTRAINT IF EXISTS personality_habits_category_check;

UPDATE public.personality_habits SET category = 'leadership' WHERE category = 'mindset';
UPDATE public.personality_habits SET category = 'wealth'     WHERE category = 'productivity';

ALTER TABLE public.personality_habits
  ALTER COLUMN category SET DEFAULT 'health';

ALTER TABLE public.personality_habits
  ADD CONSTRAINT personality_habits_category_check
  CHECK (category IN ('health', 'wealth', 'leadership', 'social', 'family'));
