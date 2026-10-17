-- 054_reward_spend_amount.sql
-- Optional real-money allowance on a reward ("New clothes — ₹2,000 to
-- spend"). Unlocking the reward means you've earned the right to spend it.
-- Snapshotted on redemptions like title/point_cost, so editing the catalog
-- later doesn't rewrite history. NULL = no amount (points-only reward).

ALTER TABLE public.reward_catalog
  ADD COLUMN IF NOT EXISTS spend_amount NUMERIC(12, 2)
  CHECK (spend_amount IS NULL OR spend_amount > 0);

ALTER TABLE public.reward_redemptions
  ADD COLUMN IF NOT EXISTS spend_amount NUMERIC(12, 2);
