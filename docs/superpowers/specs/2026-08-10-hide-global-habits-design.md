# Hiding global habits per user

## Problem

Global habits (admin-created, `personality_habits.is_global = true`) are automatically merged into
every user's habit list with no opt-out: `HabitTracker.tsx` fetches with
`.or('user_id.eq.${userId},is_global.eq.true')`, so any habit an admin marks global appears for
every user immediately, forever. As the pool of global habits grows, users end up tracking habits
they never chose and don't want, which feels overwhelming.

There's no existing suppression mechanism anywhere in the codebase (`hidden`, `archived`,
`opt_out`, `dismissed` — no matches). Personal habits can already be deleted by their owner, so
this problem is specific to global habits, which users cannot delete (admin-owned, RLS blocks
non-admin writes to global rows per `044_tighten_habit_rls.sql`).

Users should be able to remove a global habit from their own view, and bring it back later if they
change their mind.

## Design

Follow the same per-user overlay pattern used for keystone-marking a global habit
(`docs/superpowers/specs/2026-08-01-personal-keystone-for-global-habits-design.md`): rather than
writing to the shared `personality_habits` row (which RLS forbids and which would affect every
user), add a new table holding per-user state, keyed by `(user_id, habit_id)`.

A row's existence in the new table means "hidden for this user." Hiding is opt-out, not an
allow-list: a newly-created global habit is visible to everyone by default, including users who've
hidden other unrelated global habits.

Past logs and streaks are untouched by hiding — `habit_logs` rows are never read or written by
this feature. Hiding only removes a habit from the active tracker/quick-log going forward; it does
not affect `habit_logs` history or past scoring for days already logged.

### Schema

New migration `046_user_hidden_habits.sql`:

```sql
CREATE TABLE public.user_hidden_habits (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID NOT NULL REFERENCES public.personality_habits(id) ON DELETE CASCADE,
  hidden_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, habit_id)
);

ALTER TABLE public.user_hidden_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own hidden habits" ON public.user_hidden_habits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Not DB-enforced to global-only habits (no trigger checking `personality_habits.is_global`) — same
convention as `user_habit_keystones`, which also relies on the app only ever writing rows for
global habits.

### Application logic (`src/components/personality/HabitTracker.tsx`)

- Alongside the existing `globalKeystoneMarks` query (lines 355-364), add a parallel
  `useCachedQuery` for `user_hidden_habits` (`select('habit_id')`, `.eq('user_id', userId)`),
  held as `hiddenHabitIds: Set<string>` (same `useMemo` shape as `globalKeystoneIds`,
  lines 366-369).
- Derive `visibleHabits = habits.filter(h => !h.is_global || !hiddenHabitIds.has(h.id))` and use
  that (not raw `habits`) for the main render loop (~709-845). Personal habits are never filtered.
- Add `hideGlobalHabit(habit)` / `unhideGlobalHabit(habit)`, mirroring `toggleKeystone`'s
  optimistic-update pattern (lines 585-613): set an in-flight lock, update `hiddenHabitIds` in
  local state immediately, then `INSERT`/`DELETE` on `user_hidden_habits`, clearing the lock after.
- Add a "Manage global habits" trigger button near the existing "Add Habit" button, opening a new
  `ManageGlobalHabitsModal` component. Build it with the existing `ui/dialog.tsx` Radix
  `Dialog`/`DialogContent` primitives, matching how `AddHabitModal` and `EditHabitModal` are
  already built inline in this same file (lines 107-168, 200-256) — not the hand-rolled overlay
  pattern used in `AdminDashboard.tsx`, which is a different (admin-only) surface.
- The modal lists every habit in `habits` where `is_global`, each with a toggle reflecting
  `!hiddenHabitIds.has(habit.id)`. Toggling off calls `hideGlobalHabit`, toggling on calls
  `unhideGlobalHabit`. This one screen covers both removing and restoring — no separate trash/undo
  view.

### Edge cases

- Habit deletion by admin: `ON DELETE CASCADE` on `habit_id` removes the hidden-row automatically,
  same as keystones.
- A global habit hidden while also marked keystone (via `user_habit_keystones`): the keystone row
  is left untouched. If the user later unhides the habit, its keystone mark reappears as it was.
  No cross-table cleanup needed.
- A user hides every global habit: no minimum-habit-count is enforced; an empty resulting list
  falls through to whatever empty state `HabitTracker` already renders for zero habits.
- Rapid double-toggle in the modal: reuse the same in-flight-lock guard as `toggleKeystone` so a
  second click while a write is pending is a no-op.

### Out of scope

- Personal habits: already deletable by their owner outright, so no hide mechanism is added for
  them.
- `QuickLog.tsx` / `HabitPanel`: doesn't render global habits today (only queries
  `.eq('user_id', userId)`), so it's unaffected by this change either way.
- Admin-side visibility into who has hidden a given global habit: not requested, not built.

## Testing

Manual verification in-browser (this is a UI-driven feature):

- Hide a global habit as User A via the modal; confirm it disappears from User A's tracker and
  quick-log, and confirm User B still sees it unaffected.
- Unhide it; confirm it reappears in the tracker.
- Refresh the page after hiding; confirm the hidden state persists (backed by the table, not just
  local state) and the modal reflects it correctly on reopen.
- Mark a global habit keystone, then hide and unhide it; confirm the keystone mark is preserved
  across the round-trip.
- Confirm a non-owner cannot write another user's `user_hidden_habits` row (RLS), by policy-shape
  comparison to the already-verified `user_habit_keystones` policy.
- Confirm a newly-created global habit (created by an admin after this feature ships) appears by
  default for a user who has hidden other global habits.
