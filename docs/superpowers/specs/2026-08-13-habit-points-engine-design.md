# Unified habit + todo points engine

## Problem

`supabase/migrations/043_reward_system.sql` already added a full schema for a spendable points
economy — `user_rewards` (balance + perfect-day streak state), `reward_catalog`, `reward_redemptions`,
`reward_points_log`, and `personality_habits.last_milestone_awarded` — but nothing in the app reads or
writes any of it. The only "points" a user currently sees are two unrelated, purely-cosmetic things:
`CoinBurst`/`useHabitCelebration` (a coin animation on habit completion with no persistence at all) and
`TaskRewards.tsx` (a fully client-computed todo gamification widget — Seedling→Legend tiers, streak,
weekly activity grid — derived live from `todos.completed_at`/`due_date`, never written anywhere).

Users should earn real, persisted, spendable points from both habits and todos, redeemable against a
self-defined reward catalog.

## Design

### Point values

- Habit completion: **10 pts**, or **20 pts** for a keystone habit — reusing the existing
  keystone-based weight (`habitWeight()` in `HabitTracker.tsx`, 2× for keystone / 1× otherwise; there is
  no category-based weighting anywhere in this codebase today, so none is introduced here).
- Todo completion: **unchanged** — still exactly `taskPoints()`'s existing 10 base + 5 on-time bonus.
  `TaskRewards.tsx` keeps computing and rendering its own live tier display exactly as it does today;
  this feature adds a second, independent write into the persisted ledger alongside it. The two are not
  reconciled or deduplicated against each other — `TaskRewards` remains a display, the ledger is now
  also fed from the same completion event.

### Milestones

- **Per-habit streak milestones**: 7 / 30 / 60 / 90 / 180 / 365 days → 25 / 100 / 250 / 500 / 1000 / 2500
  pts. `personality_habits.last_milestone_awarded` holds the highest rung already paid for the *current*
  run and resets to 0 whenever `computeStreak()` (`src/lib/habitStreak.ts`) resets that habit's
  `streak_count` back to 1 — so the ladder re-earns on every new run rather than being a lifetime bonus.
- **Perfect-day bonus**: a day where every daily-frequency, currently-visible habit is marked done earns
  a flat **20 pts**, plus the *same* 7/30/60/90/180/365 ladder (same point values) applied to the
  perfect-day streak itself. `user_rewards.current_perfect_streak`/`longest_perfect_streak`/
  `last_perfect_date` track the streak; `last_overall_milestone` is its ladder position, resetting to 0
  whenever a day passes without becoming perfect. Weekly-frequency habits are excluded from the
  perfect-day check entirely (they aren't due every day). Hidden global habits (`user_hidden_habits`)
  are excluded, matching how they're already excluded from every other habit computation.

### Atomicity

A single Postgres function, `award_points(p_user_id uuid, p_delta int, p_reason text)`, does the insert
into `reward_points_log` and the balance increment on `user_rewards` (creating the row on first award if
missing) in one statement, called via `supabase.rpc('award_points', ...)`. This is a deliberate departure
from this codebase's usual client-side read-then-write convention (e.g. `streak_count` updates read
current state then write it back) — a spendable balance is worth protecting from lost-update races in a
way a habit streak count isn't. Every other write in this feature (habit logs, todo completion, catalog
CRUD, redemptions) keeps using ordinary client-side Supabase calls, matching existing patterns.

### Write paths

- **Habit completion** (`HabitTracker.tsx`'s `markDone`/`markDoneForYesterday`, wherever a habit_logs row
  is successfully written as `done`): after the existing streak update, call `award_points` for the base
  amount, then check whether the new `streak_count` crossed a new milestone rung (compare against
  `last_milestone_awarded`) and award+advance it if so, then check whether this completion makes today a
  perfect day (every visible daily habit now done) and if so award the perfect-day bonus/streak/ladder.
- **Todo completion**: wherever a todo's `is_completed`/`completed_at` gets set true (not yet located —
  the implementation plan pins the exact file), call `award_points` with the same `taskPoints()` value
  already computed for the live display, so the two numbers can never drift apart.
- **Redemption**: spending points is a plain client-side transaction — check `points_balance >=
  point_cost`, insert into `reward_redemptions` (snapshotting title/cost so later catalog edits don't
  rewrite history), then decrement the balance. This one is a simple decrement, not routed through
  `award_points` (which is additive-only by design — redemptions are a distinct, user-initiated action,
  not an automatic award).

### UI

- A compact points-balance chip in the Habit Tracker header, next to the existing "done today" line —
  reads `user_rewards.points_balance` for the current user, updates after any award in the same session.
- A new **Rewards** page: current balance, a user-managed catalog (add/edit/delete a reward with a title
  and point cost), a "Redeem" action per catalog item (disabled if balance is insufficient), and a
  scrollable history of `reward_points_log` entries (reason + delta + timestamp) plus `reward_redemptions`.
  Needs a nav entry (Sidebar/BottomNav) to reach it — exact placement decided in the implementation plan
  by following this app's existing nav-entry pattern.

## Out of scope

- No change to `TaskRewards.tsx`'s visual tier system, streak calc, or weekly grid — it stays exactly as
  it is; only a new, separate ledger write is added alongside its existing (unchanged) display logic.
- No retroactive point awards for habit/todo completions that already happened before this ships — the
  ledger starts accruing from the day this feature goes live.
- No admin-side visibility into other users' points/redemptions.
- No expiring points, no negative balances (a redemption that would drop the balance below zero is
  simply blocked client-side rather than allowed and clamped).

## Testing

Manual verification in-browser (no test framework in this repo):

- Complete a regular habit; confirm the points chip increases by 10 and a `reward_points_log` row exists
  with the right reason text.
- Complete a keystone habit; confirm +20 instead of +10.
- Drive a habit's streak across the 7-day threshold; confirm a one-time +25 milestone award fires exactly
  once, not on every subsequent day, and that breaking the streak and rebuilding it to 7 again re-awards it.
- Complete every daily habit in one day; confirm the +20 perfect-day bonus fires, and that the perfect-day
  streak/ladder advances the same way the per-habit one does across a multi-day run.
- Complete a todo; confirm the points chip increases by the same amount `TaskRewards.tsx` displays for
  that completion, and that `TaskRewards.tsx`'s own display is completely unaffected.
- Add a reward catalog item, redeem it with sufficient balance (confirm balance decrements and a
  `reward_redemptions` row appears), then attempt to redeem with insufficient balance (confirm it's
  blocked).
- Confirm a second browser tab/session for a different user never sees the first user's balance,
  catalog, or history (RLS).
