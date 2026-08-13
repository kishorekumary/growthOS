-- One row per user: running balance + overall "perfect day" streak state.
CREATE TABLE public.user_rewards (
  user_id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points_balance              INTEGER NOT NULL DEFAULT 0,
  current_perfect_streak      INTEGER NOT NULL DEFAULT 0,
  longest_perfect_streak      INTEGER NOT NULL DEFAULT 0,
  last_perfect_date           DATE,
  last_overall_milestone      INTEGER NOT NULL DEFAULT 0, -- highest overall milestone paid for the current run
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rewards" ON public.user_rewards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per-habit: highest streak milestone already paid out for the CURRENT run.
-- Resets to 0 whenever the habit's streak breaks, so the ladder can be
-- re-earned on the next run instead of being a one-time lifetime bonus.
ALTER TABLE public.personality_habits
  ADD COLUMN IF NOT EXISTS last_milestone_awarded INTEGER NOT NULL DEFAULT 0;

-- User-defined reward catalog.
CREATE TABLE public.reward_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  point_cost  INTEGER NOT NULL CHECK (point_cost > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reward catalog" ON public.reward_catalog
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- History of redemptions. Snapshots title/cost so editing or deleting a
-- catalog item later doesn't change past history.
CREATE TABLE public.reward_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  point_cost  INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reward redemptions" ON public.reward_redemptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Audit trail of every point change ("Daily: Meditate", "Milestone: Meditate
-- 30-day streak", "Redeemed: Dinner out") — makes the point balance legible.
CREATE TABLE public.reward_points_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reward_points_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reward points log" ON public.reward_points_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
