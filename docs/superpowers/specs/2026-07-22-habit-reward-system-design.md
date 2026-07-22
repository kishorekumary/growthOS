# Habit Reward System — Design Spec

Date: 2026-07-22

## Goal

Reward consistent habit performance with points, celebrated via a milestone
popup, redeemable against the user's own self-defined real-world rewards
("dinner out", "small trip", etc). Two independent things earn points:
individual habit streaks, and an overall "perfect day" streak across all
daily habits.

## Data model

New tables (migration `043_reward_system.sql`):

```sql
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

-- History of redemptions. Snapshots title/cost so editing or deleting a
-- catalog item later doesn't change past history.
CREATE TABLE public.reward_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  point_cost  INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit trail of every point change ("Daily: Meditate", "Milestone: Meditate
-- 30-day streak", "Redeemed: Dinner out") — makes the point balance legible.
CREATE TABLE public.reward_points_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

All four new tables get RLS enabled with an "own data" policy (`auth.uid() =
user_id`), matching every other per-user table in this codebase.

**Backfill for existing habits**: when the migration runs, existing habits
already have a `streak_count` built up before this feature existed. To avoid
a jarring flood of retroactive milestone popups the moment the feature ships,
`last_milestone_awarded` is backfilled to the highest milestone threshold
already reached by each habit's current `streak_count` (so a habit already
at a 45-day streak backfills to 30, not 0 — no burst of 7/14/30-day bonuses
firing at once on first load, but the *next* new milestone crossed, 60 days,
pays out normally).

## Point economy

- **Daily**: +5 points per habit marked done, +10 for keystone habits (they
  already count double elsewhere in this app).
- **Per-habit milestone bonus** (on top of daily points, paid once per
  threshold crossed per streak run): 7d = +50, 14d = +100, 30d = +250,
  60d = +500, 90d = +1000, 180d = +2000, 365d = +5000.
- **Overall "perfect day" streak milestone bonus** (bigger, since harder to
  hit): 7d = +150, 14d = +300, 30d = +750, 60d = +1500, 90d = +3000,
  180d = +6000, 365d = +15000.

## "Perfect day" definition

A day counts as "perfect" if every *daily*-frequency habit **visible to the
user** — their own habits plus any global habits (`is_global = true`, shown
in every user's tracker) — was marked done that day, with two exclusions:

- Weekly-frequency habits don't count; they don't need daily action.
- Habits marked **missed/skipped** ("not possible today") don't count either
  and don't break the streak. `HabitTracker.tsx` already excludes missed
  habits from its own "X/Y done today" tally (`visible = pending.length +
  doneList.length`, missed habits excluded) — perfect-day uses the same
  convention: only a habit still sitting **pending** (actionable, not done,
  not skipped) blocks "perfect."

Missing (leaving pending) any one qualifying habit breaks the streak back to
a fresh run, consistent with how per-habit streaks already behave elsewhere
in this app (`computeStreak`).

## Where the logic lives

Habits are currently marked done from three separate places:
`HabitTracker.tsx` (`markDone`), `QuickLog.tsx`'s `HabitPanel` (`markDone`),
and the voice-log confirm flow (`VoicePanel.confirmLog`, habit branch). Each
directly writes to `personality_habits` and `habit_logs` via the browser
Supabase client.

This design consolidates all reward logic (points, milestone detection,
perfect-day tracking) into one new endpoint, **`POST /api/habits/complete`**,
which does the existing streak-count update + `habit_logs` upsert *and* the
new reward calculation in one place, returning any newly-earned milestones
in the response. All three existing call sites switch to call this endpoint
instead of writing directly to Supabase. This avoids tripling the
milestone-detection logic and keeps the reward state consistent regardless
of which UI surface completed the habit.

Endpoint responsibilities, in order:
1. Look up the habit, compute the new `streak_count` (reusing the existing
   `computeStreak` logic, moved server-side).
2. Upsert `habit_logs` for today as `done`.
3. Update `personality_habits` (`streak_count`, `longest_streak`,
   `last_done_at`, `updated_at`).
4. Award daily points (+5 / +10 keystone) — insert into `reward_points_log`,
   increment `user_rewards.points_balance`.
5. Check per-habit milestone: if `streak_count` has crossed a threshold
   greater than `last_milestone_awarded`, award the bonus and update
   `last_milestone_awarded` (reset to 0 first if this call's streak_count
   indicates the run broke and restarted, i.e. streak_count === 1).
6. Check perfect-day: query all daily-frequency habits visible to the user
   (own rows + `is_global = true` rows) and today's `habit_logs` for them —
   if every one is either `done` (this call included) or `missed` (skipped,
   excluded per the definition above), and `last_perfect_date` isn't already
   today, increment `current_perfect_streak` (or reset to 1 if yesterday
   wasn't perfect), update `longest_perfect_streak` if applicable, and check
   the overall milestone ladder the same way as step 5.
7. Return `{ streak_count, milestones: [...] }` where `milestones` is an
   array of zero or more newly-earned milestones (each with a label and
   point amount) for the client to display.

## UI

**Milestone popup** (`RewardMilestoneModal`): a celebratory full-screen
modal shown when the completion response includes one or more milestones.
If more than one fires at once (e.g. a habit's individual streak *and* the
overall perfect-day streak both cross a threshold from the same action),
it steps through them one at a time rather than cramming them together.

**New `/rewards` page**: points balance (prominent), current streaks
(per-habit list + overall perfect-day streak), the user's reward catalog
with a redeem button per item (disabled if the balance is short), a
management view to add/edit/delete catalog entries, and redemption history.
Added to `Sidebar`, `BottomNav`, and `MobileDrawer` navigation.

**Starter catalog**: seeded only when a user's catalog is empty (new users,
or existing users visiting `/rewards` for the first time) — Coffee treat
(100 pts), Dinner out (300 pts), Movie night (500 pts), Small day trip
(2500 pts), Weekend getaway (5000 pts). Fully editable/deletable afterward.

## Redemption flow

User taps "Redeem" on an affordable catalog item → confirms → deducts
`points_balance`, inserts a `reward_redemptions` row (snapshotting
title/cost) and a `reward_points_log` entry (`"Redeemed: <title>"`,
negative delta). This is honor-system — the app can't verify a real-world
trip actually happened, and isn't meant to.

## Edge cases

- Insufficient points: redeem button disabled, no server round-trip needed.
- Empty catalog: `/rewards` prompts to add the first reward instead of
  showing an empty list.
- Weekly-frequency habits: excluded from the perfect-day calculation, but
  still earn their own daily points and per-habit milestones normally.
- Two updates racing (e.g. rapid double-tap): the completion endpoint is the
  single write path, so this is a normal concurrent-request scenario handled
  by the existing per-row update pattern — no special locking needed beyond
  what already exists for `personality_habits` writes today.

## Out of scope

- No streak-loss point penalty — missing a day resets the milestone ladder
  for that streak but doesn't deduct already-earned points.
- No verification that a redeemed reward was actually taken — explicitly
  honor-system per the "how should redemption work" discussion.
- No test framework exists in this repo; verification is via `tsc --noEmit`,
  a full `next build`, and manual reasoning/walkthrough, consistent with how
  every other feature in this codebase has been verified so far.
