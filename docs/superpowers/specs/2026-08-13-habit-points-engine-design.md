# Unified habit + todo points engine

> **Supersedes** the same-named draft written earlier today. That draft used different point values
> and a simpler (client-writes-only) architecture, written before discovering that
> [`2026-07-22-habit-reward-system-design.md`](2026-07-22-habit-reward-system-design.md) already exists
> for this exact feature and is considerably more thorough. This doc adopts that spec's economy and
> architecture wholesale (do not re-derive point values or the endpoint design — read that file) and
> adds two things it doesn't cover: the grace-period "yesterday" catch-up path, and todo completions.

## What carries over unchanged from the 2026-07-22 spec

- Point values: 5 pts / habit completion, 10 pts for keystone habits.
- Per-habit milestone ladder (7/14/30/60/90/180/365 days → 50/100/250/500/1000/2000/5000 pts) and the
  separate, bigger perfect-day-streak ladder (150/300/750/1500/3000/6000/15000 pts).
- "Perfect day" definition (all daily-frequency habits — own + global — either done or missed/skipped;
  only a habit left pending blocks it).
- The consolidated completion architecture: one endpoint owns the streak update, points award, and
  milestone detection, so the logic isn't tripled across call sites.
- `increment_points_balance(p_user_id, p_delta)` atomic RPC, the milestone celebration popup
  (`RewardMilestoneModal` via a `RewardContext`), the `/rewards` page (balance, streaks, catalog,
  redemption history), the starter catalog, and the honor-system redemption flow.
- Migration backfill of `last_milestone_awarded` for habits with pre-existing streaks.

## What's changed in the codebase since 2026-07-22 (why the old plan's diffs are stale)

Three things shipped after that spec was written, and the consolidated endpoint must account for all of
them even though the old plan's code samples predate them:

1. **Shared streak logic**: `computeStreak`/`isGraceActive`/`graceDeadlineToday` now live in
   `src/lib/habitStreak.ts`, imported by both `HabitTracker.tsx` and `QuickLog.tsx` — no more per-file
   duplicate `computeStreak` to delete; it's a shared import with other callers, so it stays.
2. **Grace-period "yesterday" catch-up**: `HabitTracker.tsx`'s `markDoneForYesterday` (and `QuickLog`'s
   equivalent) let a user catch up a missed daily habit before noon the next day, scored as if done
   yesterday. The 2026-07-22 endpoint design only ever handles "today" — as written, a caught-up habit
   would silently earn no points/milestones, which is a real gap, not an acceptable omission (grace
   catch-up is an actively-used, banner-advertised feature).
3. **Hidden global habits** (`user_hidden_habits`) and the **coin-burst celebration**
   (`useHabitCelebration`/`celebrate()`) both need to keep working exactly as they do today — hidden
   habits stay excluded from the perfect-day set (same as everywhere else they're excluded), and
   `celebrate()` still fires on a successful completion regardless of whether a milestone also fired.

**Fix**: `POST /api/habits/complete` takes an optional `for: 'today' | 'yesterday'` (default `'today'`)
instead of assuming today. `for: 'yesterday'` upserts `habit_logs` for yesterday's date, computes the
streak against yesterday as the reference date (mirroring `markDoneForYesterday`'s existing
`computeStreak(..., yesterdayDate)` call), and otherwise runs the exact same points/milestone/perfect-day
logic — perfect-day is evaluated against *yesterday's* date in that branch, not today's, matching what
the pre-existing grace-catch-up already scores against.

## Addition: todo points

Todo completions earn into the *same* `user_rewards.points_balance`/`reward_points_log`, using the
`taskPoints()` value `TaskRewards.tsx` already computes (10 base + 5 on-time bonus) — exported from that
file and called wherever a todo's `is_completed`/`completed_at` gets set (`TodoList.tsx`'s and
`TodoWidget.tsx`'s `handleComplete`), via the same `awardPoints`-style insert-and-RPC pattern used by the
habit endpoint (a plain client-side call is fine here — todos have no milestone/perfect-day logic to
consolidate, so there's no need for a dedicated API route the way habits needed one for their three call
sites). `TaskRewards.tsx` itself is untouched — its own tier/streak/weekly-grid display keeps computing
live from `todos`, completely independent of the ledger.

## Out of scope (same as 2026-07-22, plus)

Everything the original spec excluded, plus: no todo milestones, no todo "perfect day" concept, no
change to `TaskRewards.tsx`'s UI or scoring.

## Testing

Same manual checklist as the 2026-07-22 spec, plus: catch up a missed habit via the grace-period banner
before noon and confirm it awards points/milestones identically to marking it done same-day; complete a
todo and confirm the points chip increases by the exact amount `TaskRewards.tsx` shows for it.
