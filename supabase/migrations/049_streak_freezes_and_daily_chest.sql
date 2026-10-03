-- ============================================================
-- 049_streak_freezes_and_daily_chest.sql
--
-- Streak freezes: a held count on user_rewards. One freeze covers one whole
-- missed calendar day — every daily habit streak plus the perfect-day
-- streak. Consumed lazily by /api/habits/complete when the user comes back
-- after missing exactly one day, never by the nightly cron, so the noon
-- grace-period catch-up still works and a freeze is never wasted on a day
-- the user later catches up.
--
-- Daily chest: one claim per user per local day, unlocked by the day's
-- first completed habit (enforced in /api/rewards/daily-chest).
--
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE / drop-then-create.
-- ============================================================

ALTER TABLE public.user_rewards
  ADD COLUMN IF NOT EXISTS streak_freezes INTEGER NOT NULL DEFAULT 0 CHECK (streak_freezes >= 0);

-- Which missed days a freeze has already covered — makes consumption
-- idempotent across the several habit completions that hit the same gap.
CREATE TABLE IF NOT EXISTS public.streak_freeze_uses (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  covered_date DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, covered_date)
);

ALTER TABLE public.streak_freeze_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own streak freeze uses" ON public.streak_freeze_uses;
CREATE POLICY "own streak freeze uses" ON public.streak_freeze_uses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.daily_chest_claims (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date   DATE NOT NULL,
  chest_streak INTEGER NOT NULL,           -- consecutive days claimed, including this one
  points       INTEGER NOT NULL DEFAULT 0,
  gave_freeze  BOOLEAN NOT NULL DEFAULT FALSE,  -- not "freeze": reserved word in Postgres
  label        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, claim_date)
);

ALTER TABLE public.daily_chest_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own daily chest claims" ON public.daily_chest_claims;
CREATE POLICY "own daily chest claims" ON public.daily_chest_claims
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Covers p_covered_date with a freeze. Returns true if that day is (now or
-- already) covered, false if the user had no freeze to spend. Safe to call
-- repeatedly and concurrently for the same day: only one freeze is spent.
CREATE OR REPLACE FUNCTION public.use_streak_freeze(p_user_id UUID, p_covered_date DATE)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.streak_freeze_uses
             WHERE user_id = p_user_id AND covered_date = p_covered_date) THEN
    RETURN TRUE;
  END IF;

  UPDATE public.user_rewards
  SET streak_freezes = streak_freezes - 1, updated_at = NOW()
  WHERE user_id = p_user_id AND streak_freezes > 0;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.streak_freeze_uses (user_id, covered_date)
  VALUES (p_user_id, p_covered_date)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    -- A concurrent call covered this day first; refund ours.
    UPDATE public.user_rewards
    SET streak_freezes = streak_freezes + 1, updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
  RETURN TRUE;
END;
$$;

-- Adds one freeze if the user holds fewer than p_max. Returns whether it did.
CREATE OR REPLACE FUNCTION public.grant_streak_freeze(p_user_id UUID, p_max INTEGER)
RETURNS boolean
LANGUAGE sql
AS $$
  WITH updated AS (
    UPDATE public.user_rewards
    SET streak_freezes = streak_freezes + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND streak_freezes < p_max
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- Atomic purchase: deducts p_cost and adds a freeze only if the balance
-- covers it and the user holds fewer than p_max. Returns whether it did.
CREATE OR REPLACE FUNCTION public.buy_streak_freeze(p_user_id UUID, p_cost INTEGER, p_max INTEGER)
RETURNS boolean
LANGUAGE sql
AS $$
  WITH updated AS (
    UPDATE public.user_rewards
    SET points_balance = points_balance - p_cost,
        streak_freezes = streak_freezes + 1,
        updated_at     = NOW()
    WHERE user_id = p_user_id AND points_balance >= p_cost AND streak_freezes < p_max
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;
