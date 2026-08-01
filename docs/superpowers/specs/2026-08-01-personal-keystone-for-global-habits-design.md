# Personal keystone marking for global habits

## Problem

Keystone status (up to 2 habits a user flags as most important, weighted 2x) is stored as a
single boolean column, `personality_habits.is_keystone`. For a personal habit that's fine — one
row per user. For a global habit (admin-created, `is_global = true`, one shared row visible to
every user), that column is shared: writing to it would flip keystone status for *every* user,
not just the one who clicked it. RLS also blocks non-admins from writing to a global row at all
(`044_tighten_habit_rls.sql`), so today the UI just hides the "mark as keystone" control entirely
for global habits (`src/components/personality/HabitTracker.tsx`, crown button wrapped in
`{!habit.is_global && (...)}`).

Users should be able to mark a global habit as keystone for themselves, without affecting any
other user.

## Design

Follow the existing pattern already used for per-user state on top of a shared global row:
`habit_logs` overlays daily completion per user on top of a shared `personality_habits` row.
Keystone-for-global-habits gets the same treatment — a new per-user overlay table, rather than
writing to the shared column.

Personal habits keep using `personality_habits.is_keystone` unchanged; only global habits move to
the new table. This is a smaller change and needs no data migration, at the cost of keystone
status living in two places depending on habit type — reads/writes go through one helper
(`isKeystoneFor`, below) so callers don't need to know which.

### Schema

New migration `045_user_habit_keystones.sql`:

```sql
CREATE TABLE public.user_habit_keystones (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID NOT NULL REFERENCES public.personality_habits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, habit_id)
);

ALTER TABLE public.user_habit_keystones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own keystones" ON public.user_habit_keystones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

A row's existence means "this user has marked this global habit as keystone for themselves."
Intended for use with global habit rows, but not DB-enforced (no trigger checking
`personality_habits.is_global`) — the app only ever writes here for `is_global` habits, mirroring
how `habit_logs` isn't restricted at the DB level either.

### Application logic (`src/components/personality/HabitTracker.tsx`)

- Alongside the existing `personality_habits` fetch, also fetch the current user's rows from
  `user_habit_keystones` (just `habit_id`) and hold as `globalKeystoneIds: Set<string>` state.
- Add a helper:
  ```ts
  const isKeystoneFor = (habit: Habit) =>
    habit.is_global ? globalKeystoneIds.has(habit.id) : habit.is_keystone
  ```
  Replace every direct read of `habit.is_keystone` (badge visibility, sort ordering,
  `habitWeight`, the cap check) with `isKeystoneFor(habit)`.
- `keystoneCount` (for the max-2 cap) becomes `habits.filter(isKeystoneFor).length` — combined
  across personal + global habits, matching the existing "2 keystones total" intent.
- `toggleKeystone(habit)`:
  - Personal habit → unchanged: `UPDATE personality_habits SET is_keystone = ...`.
  - Global habit → `INSERT INTO user_habit_keystones` to mark, or
    `DELETE ... WHERE user_id = ... AND habit_id = ...` to unmark. Update `globalKeystoneIds`
    optimistically in local state, same pattern as the existing personal-habit optimistic update.
  - Cap check becomes `if (!isKeystoneFor(habit) && keystoneCount >= 2) return`.
- Remove the `{!habit.is_global && (...)}` wrapper around the crown button so it renders for
  global habits too. Leave the `!habit.is_global` guards on Edit/Delete untouched — those stay
  admin-only.
- Update the two badge-visibility checks (currently `habit.is_keystone && !habit.is_global`) to
  just `isKeystoneFor(habit)`.

### Edge cases

- Any legacy `is_keystone = true` on a global row (possible pre-`044_tighten_habit_rls.sql`, when
  admins had blanket write access to global rows) becomes irrelevant automatically —
  `isKeystoneFor` never reads `habit.is_keystone` for a global habit, only the overlay table. No
  cleanup migration needed.
- Rapid double-toggle: reuse the existing `keystoneId` in-flight guard so a second click while a
  write is pending is a no-op, same as today.
- Habit deletion: `ON DELETE CASCADE` on `habit_id` removes the overlay row automatically.

### Out of scope

- `docs/superpowers/specs/2026-07-22-habit-reward-system-design.md` plans a future points system
  that weights keystone habits (+10 vs +5 points/day), reading `personality_habits.is_keystone`
  directly. That feature isn't built yet. Whoever implements it will need to read keystone status
  via the same `isKeystoneFor`-equivalent logic (checking `user_habit_keystones` for global habits)
  rather than the raw column, or keystone-marked global habits will silently get the non-keystone
  point value. Not addressed here since the reward system doesn't exist yet.

## Testing

Manual verification in-browser (this is a UI-driven feature):

- Mark a global habit keystone as User A; confirm User B does not see it as keystone.
- Confirm the crown button now renders on global habit cards.
- Confirm the 2-keystone cap blocks a 3rd across personal + global combined, and that unmarking
  one frees a slot.
- Confirm unmarking a global keystone removes the row (not just flips a flag) — check via
  Supabase table view or a second read.
- Confirm a non-owner cannot write another user's `user_habit_keystones` row (RLS) — attempt via
  browser dev tools with a second session, or trust policy review since RLS policy is identical
  in shape to `habit_logs`' already-verified policy.
