# Backdating check-ins on the 90-day challenge

## Problem

`ChallengeDetail.tsx` only lets you mark *today* complete. `checkIn()` (lines 141-164) hardcodes
`checkin_date: today`, and the entire check-in card is gated behind `isTodayInRange` (line 121),
which requires `challenge.status === 'active'` and the computed `dayNumber` to equal today's day.
The 15-column heatmap (lines 276-300) renders every day's state but the cells are plain `<div>`s
with no `onClick` — there is no way to mark, unmark, or add a reflection to a day other than today,
including yesterday.

There's no DB-level restriction causing this: `challenge_checkins` (migration `026`) is keyed on
`(challenge_id, checkin_date)` with a simple owner-only RLS policy, so an upsert with any past date
already works today from the DB's point of view. The restriction is entirely in the React
component.

## Design

### Editable window

A day is editable if all of the following hold:

- its date is not in the future (`dateStr <= today`)
- it's within 3 days of today, i.e. `today`, `today - 1`, `today - 2`, or `today - 3`
- it falls within the challenge's actual day range: `1 <= dayNumberForDate(dateStr) <= totalDays`

This is a single predicate, independent of `challenge.status`. It applies the same way whether the
challenge is `active`, `abandoned`, or `completed` — no per-status branching.

```js
function isEditableDate(dateStr) {
  if (dateStr > today) return false
  if (differenceInDays(parseISO(today), parseISO(dateStr)) > 3) return false
  const dn = differenceInDays(parseISO(dateStr), startDate) + 1
  return dn >= 1 && dn <= totalDays
}
```

### Interaction

Heatmap cells (lines 289-298) for which `isEditableDate` is true get `onClick`, a pointer cursor,
and a hover ring — the same visual language already used for the today/milestone rings on that
grid. Clicking one opens a `DayEditModal` (built with the existing `Dialog`/`DialogContent`
primitives, matching `EditChallengeModal` right below in the same file):

- Header: "Day N · Aug 9"
- If no existing checkin for that date: a reflection textarea (optional) + "Mark complete" button
- If a checkin exists: the current reflection (editable) + "Mark incomplete" button, plus a "Save"
  action if the reflection text changed without touching completion state

Non-editable cells (future, out-of-range, or older than 3 days) are unchanged — no `onClick`, same
inert appearance as today.

### Shared write path

Generalize `checkIn()` into `saveCheckin(date, completed, reflection)`:

- `completed === true`: upsert into `challenge_checkins` as today, but with `checkin_date: date`
  instead of the hardcoded `today`.
- `completed === false`: delete the row (`.delete().eq('challenge_id', ...).eq('checkin_date',
  date)`) rather than writing `completed: false`. The table has never stored `completed: false`
  rows — "no row" already means "not done" everywhere it's read (heatmap, streak calc,
  `completedCount`) — so deleting keeps that invariant instead of introducing a second
  not-done representation.
- After either branch, run the same final-day auto-complete check as today, but keyed off the
  *edited* date's day number, not the closure `dayNumber` (which is always today's):
  `differenceInDays(parseISO(date), startDate) + 1 >= totalDays`.

`DayEditModal` and the existing "Today's check-in" card both call `saveCheckin`. The Today card's
JSX/UX doesn't change — it still shows the green "complete" state or the inline textarea + button —
but it stops duplicating the upsert logic, and gains a small "Undo" text button next to the
completed state (calls `saveCheckin(today, false, ...)`), since un-marking is now supported and
today shouldn't be an exception.

### Abandoned challenges: completed, not "reactivated"

`isChallengeExpired()` (`ChallengeApp.tsx` lines 48-51) is purely date-based: a challenge becomes
abandoned only once *all* its days have elapsed with no final check-in — never because of a
mid-challenge gap. So there's no scenario where backdating should flip a challenge from `abandoned`
back to `active`; the days it lost are still lost either way.

What actually fixes an abandoned challenge is backfilling day `totalDays` itself. Once
`saveCheckin` keys the auto-complete check off the edited date (see above), backfilling that final
day as complete already sets `status: 'completed'` via the exact same branch `checkIn()` uses
today (lines 152-159) — no new status-transition branch needed. This only works within the 3-day
grace window, i.e. you can rescue a challenge you finished but forgot to check in for, within 3
days of it ending — not indefinitely.

### Out of scope

- Un-marking the final day of an already-`completed` challenge does not roll `status` back to
  `active`. That's a lifecycle edge case beyond backdating a missed day, and the checkin table
  (not `status`) stays the source of truth for the day-by-day record either way.
- No change to `challenge_milestones` cache invalidation — a backfilled day landing on a milestone
  day number won't regenerate an already-cached AI milestone message. Not requested.
- No new DB migration — `challenge_checkins` already supports arbitrary dates.

## Testing

Manual verification in-browser (UI-driven feature, no new backend surface):

- Miss a day, then tap it in the heatmap within the 3-day window: mark it complete with a
  reflection, confirm the cell turns from red (missed) to done, and `completedCount`/streak/rate
  update.
- Tap a day older than 3 days: confirm the cell has no click affordance.
- Tap a future day: confirm no click affordance.
- Mark a day complete via the modal, reopen it, tap "Mark incomplete": confirm the row disappears
  (checked via a page refresh, not just local state) and the cell reverts to missed/red.
- Let a challenge run out its final 1-3 days without checking in (or use one already in the
  `Abandoned` bucket), tap day `totalDays` in the heatmap, mark it complete: confirm the challenge
  moves to `Completed`, not `Active`.
- Confirm today's inline check-in card still works unchanged, and its new "Undo" button removes
  today's checkin correctly.
