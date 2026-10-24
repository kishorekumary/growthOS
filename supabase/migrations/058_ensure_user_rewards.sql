-- ============================================================
-- 058_ensure_user_rewards.sql
--
-- Users without a user_rewards row couldn't complete habits: the live
-- database rejects their own INSERT into user_rewards (RLS 42501), so
-- /api/habits/complete failed after the habit log was already written —
-- the UI rolled the check back and a reload showed it done again.
--
-- Rather than depend on an INSERT policy on a table that holds the points
-- balance, the row is created three ways, none of which lets a user set
-- its values:
--   1. ensure_user_rewards(): SECURITY DEFINER, inserts only the caller's
--      own default (zero-balance) row, called by the app before awarding.
--   2. A trigger creating the row for every new auth user.
--   3. A backfill for every existing user missing one.
--
-- Safe to re-run: OR REPLACE / drop-then-create / ON CONFLICT DO NOTHING.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_user_rewards()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_rewards (user_id)
  SELECT auth.uid()
  WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_rewards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_rewards() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_user_rewards_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_rewards (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_rewards ON auth.users;
CREATE TRIGGER on_auth_user_created_rewards
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_rewards_for_new_user();

INSERT INTO public.user_rewards (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
