# Overall habit progress summary

## Problem

`HabitTracker.tsx` shows per-habit stats only (a streak badge per row, and — as of the per-habit
detail modal — a longest streak and 90-day heatmap per habit on request). There's no single place to
see progress across *all* habits at once beyond the week-scoped `WeeklyScoreCard`.

## Design

### Inline list enhancement

Each row's streak badge (`HabitTracker.tsx`, the `habit.streak_count > 0 && !habit.is_global` block)
gains a small `· best N` suffix whenever `habit.longest_streak > habit.streak_count` — a quick glance at
your best-ever run for that habit without opening the detail modal. Hidden when the current streak
already equals or exceeds the best (nothing extra to show).

### Combined summary — `OverallProgressCard`

A new card rendered above the existing `WeeklyScoreCard`, following its exact visual convention (same
card shell, same "return null when there's nothing to show" pattern). Shows three stats:

- **Completion rate, last 90 days**: `doneDays / possibleDays` across all visible daily-frequency habits
  (weekly habits excluded — they have no clean "one expected per day" denominator). Each habit's own
  `created_at` clamps its contribution to the window, so a habit added recently isn't penalized for days
  before it existed. Sourced from a new all-habits `habit_logs` query for the last 90 days (mirroring the
  per-habit detail modal's window, for consistency), rather than the existing narrower `weekLogs`/
  `yesterdayLogs` fetches.
- **Best current streak**: reuses the already-computed `topStreak` (previously shown only as a small
  aside in the header text) — now also given full visual weight in this card.
- **Best-ever streak**: `Math.max(...visibleHabits.map(h => h.longest_streak))` — new, since
  `longest_streak` was fetched but never surfaced in aggregate anywhere before this feature.

## Out of scope

- No combined calendar/heatmap across all habits (the per-habit detail modal already covers per-habit
  history; a combined multi-habit heatmap was not requested).
- No separate page/route — this lives inline on the existing Habit Tracker page, per the explicit choice
  to keep it there rather than add navigation.
- No change to `WeeklyScoreCard`'s own scoring logic — the two cards are independent and sit side by side.

## Testing

Manual verification in-browser (no test framework in this repo):

- Confirm a habit whose current streak is below its longest streak shows the "· best N" suffix; one
  where they're equal (or current is the new best) does not.
- Confirm the Overall Progress card's completion rate accounts for a recently-created habit correctly
  (doesn't get dragged down by days before it existed).
- Confirm the card doesn't render when there are zero visible habits.
