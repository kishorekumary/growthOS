# Per-habit history heatmap

## Problem

`HabitTracker.tsx` shows only a single numeric streak per habit (`streak_count`) — there is no visual
history anywhere in the app for an individual habit, unlike the 90-day challenge feature which already
has a heatmap grid. `longest_streak` is fetched but never displayed anywhere either.

## Design

### Entry point

Tapping anywhere on a habit's row (`HabitTracker.tsx:925`, currently a plain `<div>` with no `onClick`)
opens a new `HabitDetailModal`. The six existing interactive buttons inside the row (mark done, mark
missed, undo, keystone toggle, edit, delete) each get `e.stopPropagation()` added to their `onClick` so
they keep working exactly as before without also opening the detail modal.

### Data

- Add `created_at` to the `Habit` interface (`HabitTracker.tsx:29-39`) and to the existing
  `personality_habits` select (`HabitTracker.tsx:431`, already orders by `created_at` but doesn't select
  it) — needed to know when a habit didn't exist yet within the 90-day window.
- `HabitDetailModal` fetches its own `habit_logs` for the last 90 days for just this habit, following
  the exact `useCachedQuery` pattern `weekLogs`/`yesterdayLogs` already use (`HabitTracker.tsx:479-491`):
  cache key `` `habit-logs:${habit.id}:90d` ``, `.select('log_date, status').eq('habit_id', habit.id).eq('user_id', userId).gte('log_date', ninetyDaysAgoStr)`, deps `[habit.id]`.

### Heatmap

A 15-column grid of the last 90 days (today back to 89 days ago), visually matching
`ChallengeDetail.tsx`'s heatmap (same `grid gap-1` / `aspect-square rounded-sm` cell shape). Since this
is a rolling window ending today, there's no "future" state to render — only two real states plus one
edge case:

- **Done**: a log exists with `status === 'done'` — colored with the habit's own category color (reusing
  `cat.badge`'s color, same as the row's existing category badge, not a new color system).
- **Not done**: everything else — no log at all, `missed`, or `auto_missed` — renders identically (muted/
  red), per the explicit decision that the missed/auto-missed distinction is points-engine-internal, not
  a user-facing visual.
- **Before the habit existed**: a day earlier than `habit.created_at` renders as a muted gray "n/a" cell,
  distinct from "not done" (the user didn't skip a day that couldn't have existed yet).
- Today's cell gets a subtle ring (matching the challenge heatmap's `ring-1 ring-white/40` treatment for
  its "today" cell) so it's identifiable regardless of done/not-done state.

### Stats row

Above the heatmap: current streak (`habit.streak_count`), longest streak (`habit.longest_streak`, not
displayed anywhere in the app today), and a count of `done` days within the fetched 90-day window.

### Out of scope

- No pagination/full-history view — 90 days only, matching the challenge heatmap's scale and avoiding
  the added complexity of an open-ended history view for habits tracked much longer than that.
- No changes to `QuickLog.tsx`'s `HabitPanel` — this is a `HabitTracker.tsx`-only feature, since that's
  the app's main habit-management surface; the Quick Log popup stays focused on fast logging.
- No new visual distinction for `missed` vs `auto_missed` in this view (see above) — that distinction
  exists only for the points engine's perfect-day logic.

## Testing

Manual verification in-browser (no test framework in this repo):

- Tap a habit row; confirm the detail modal opens showing correct current/longest streak and a 90-day
  grid whose "done" cells match that habit's category color.
- Tap the mark-done/mark-missed/undo/keystone/edit/delete buttons on a row; confirm none of them also
  open the detail modal.
- Open the detail modal for a habit created less than 90 days ago; confirm days before its creation date
  render as a distinct "n/a" gray, not as a missed day.
- Confirm today's cell is visually distinguishable (ring) regardless of whether it's marked done yet.
