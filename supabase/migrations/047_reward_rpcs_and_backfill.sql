-- ============================================================
-- 047_reward_rpcs_and_backfill.sql
--
-- Split out of 043_reward_system.sql: the live database already had the 4
-- reward tables + RLS + the personality_habits.last_milestone_awarded
-- column applied in their original form BEFORE this branch amended
-- 043_reward_system.sql to also add this backfill and these two RPC
-- functions. Re-running the amended 043 file against that live database
-- would fail on its first `CREATE TABLE` (already exists) and silently
-- skip everything after it — including these functions, which nothing in
-- the points/rewards feature works without. Moving them to their own
-- migration file (with the exact same SQL, unmodified) lets them be
-- applied on their own.
-- ============================================================

-- Backfill: existing habits already have a streak_count built up before
-- this feature existed. Set last_milestone_awarded to the highest
-- threshold already reached so there's no retroactive flood of popups
-- the moment this ships — the *next* new milestone still pays out.
UPDATE public.personality_habits
SET last_milestone_awarded = (
  SELECT COALESCE(MAX(t), 0)
  FROM unnest(ARRAY[7, 14, 30, 60, 90, 180, 365]) AS t
  WHERE t <= streak_count
);

-- Atomic balance increment/decrement (used for both awarding and
-- redemption spending) — avoids a read-then-write race between
-- concurrent requests. Runs as SECURITY INVOKER (default), so the
-- caller's own RLS policy above still applies: a mismatched p_user_id
-- simply matches zero rows.
CREATE OR REPLACE FUNCTION public.increment_points_balance(p_user_id UUID, p_delta INTEGER)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.user_rewards
  SET points_balance = points_balance + p_delta, updated_at = NOW()
  WHERE user_id = p_user_id;
$$;

-- Atomic spend: only deducts if the balance actually covers the cost,
-- avoiding the race a separate read-then-increment_points_balance call
-- would have (the only place in this schema enforcing a balance floor).
-- Returns true if the deduction happened, false if the balance was
-- insufficient (no row matched the WHERE clause, nothing was changed).
CREATE OR REPLACE FUNCTION public.redeem_points(p_user_id UUID, p_cost INTEGER)
RETURNS boolean
LANGUAGE sql
AS $$
  WITH updated AS (
    UPDATE public.user_rewards
    SET points_balance = points_balance - p_cost, updated_at = NOW()
    WHERE user_id = p_user_id AND points_balance >= p_cost
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;
