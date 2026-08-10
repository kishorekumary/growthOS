# Hiding Global Habits Per User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user hide a global (admin-created, shared) habit from their own tracker, and bring it back later, without affecting any other user or touching past logs/streaks.

**Architecture:** A new per-user overlay table, `user_hidden_habits` (one row = "this user hid this global habit"), following the exact pattern `user_habit_keystones` already uses for per-user state on top of a shared `personality_habits` row. `HabitTracker.tsx` derives a `visibleHabits` array (all habits minus hidden globals) and uses it everywhere the tracker currently reads `habits` for display/interaction; the raw `habits` array is kept around unfiltered so a new "Manage Global Habits" modal can list every global habit (hidden or not) with a toggle to hide/restore it.

**Tech Stack:** Next.js App Router, React (client component), Supabase (Postgres + RLS, `@supabase/supabase-js` browser client), TypeScript, lucide-react icons. No test framework is configured in this repo (zero `*.test.*`/`*.spec.*` files, no jest/vitest config) — verification is `npx tsc --noEmit`, `npm run lint`, and manual browser testing via the dev server, matching how the prior keystone feature in this file was verified.

## Global Constraints

- Hiding a global habit for one user must never change what any other user sees for that same habit, and must never write to the shared `personality_habits` row.
- Personal (non-global) habits are never hidden via this mechanism — they already support outright deletion by their owner (existing Trash2 button), so this feature only ever touches `is_global` habits.
- Hiding/restoring must never touch `habit_logs` or `personality_habits` (streak, `is_keystone`) — past logs and scores stay exactly as they are; only future visibility changes.
- New table `user_hidden_habits` is not DB-restricted to `is_global = true` habits (no trigger) — the app only ever writes rows there for global habits, same convention as `user_habit_keystones`.
- Migrations in this repo have no local CLI/DB link (`supabase` CLI not installed, no `DATABASE_URL`/`POSTGRES_URL` in `.env.local`) — they are applied by hand via the Supabase project's SQL Editor (see `README.md` "Run database migrations" section). Each DB task's verification step reflects this.
- A newly-created global habit (created by an admin after this feature ships) must appear by default for every user, including ones who have hidden other global habits (opt-out model, not an allow-list).

---

### Task 1: Database migration — `user_hidden_habits` table

**Files:**
- Create: `supabase/migrations/046_user_hidden_habits.sql`

**Interfaces:**
- Produces: table `public.user_hidden_habits(user_id UUID, habit_id UUID, hidden_at TIMESTAMPTZ)`, primary key `(user_id, habit_id)`, RLS policy `"own hidden habits"` scoped to `auth.uid() = user_id` for all operations. Referenced by Task 2's Supabase queries (`.from('user_hidden_habits')`).

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- 046_user_hidden_habits.sql
-- Per-user overlay hiding a GLOBAL habit from just that user's
-- tracker, without touching the shared personality_habits row
-- or affecting any other user.
--
-- Same shape as user_habit_keystones (045): a shared habit
-- definition row, with per-user state in its own table keyed
-- by (user_id, habit_id).
--
-- A row's existence means "this user has hidden this habit for
-- themselves." Not DB-restricted to is_global habits — the app
-- only ever writes here for global ones (personal habits are
-- deleted outright by their owner instead).
-- ============================================================

CREATE TABLE public.user_hidden_habits (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID        NOT NULL REFERENCES public.personality_habits(id) ON DELETE CASCADE,
  hidden_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, habit_id)
);

ALTER TABLE public.user_hidden_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own hidden habits" ON public.user_hidden_habits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration**

There's no linked Supabase CLI project or direct Postgres connection string available in this environment, so this migration can't be applied programmatically from here. Open the Supabase project's dashboard → SQL Editor, paste the full contents of `supabase/migrations/046_user_hidden_habits.sql`, and run it.

- [ ] **Step 3: Verify the table and policy exist**

In the same SQL Editor, run:

```sql
select * from public.user_hidden_habits;
```

Expected: succeeds with an empty result set, columns `user_id, habit_id, hidden_at`.

Then run:

```sql
select polname, qual, with_check from pg_policies where tablename = 'user_hidden_habits';
```

Expected: one row, `polname = 'own hidden habits'`, `qual = '(auth.uid() = user_id)'`, `with_check = '(auth.uid() = user_id)'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/046_user_hidden_habits.sql
git commit -m "feat: add user_hidden_habits table for per-user hiding of global habits"
```

---

### Task 2: Data layer — fetch hidden overlay, `visibleHabits`, hide/unhide functions

**Files:**
- Modify: `src/components/personality/HabitTracker.tsx:43-45` (interfaces area)
- Modify: `src/components/personality/HabitTracker.tsx:366-369` (right after `globalKeystoneIds`)
- Modify: `src/components/personality/HabitTracker.tsx:585-613` (right after `toggleKeystone`)
- Modify: `src/components/personality/HabitTracker.tsx:585-588` (inside `toggleKeystone`, cap check)
- Modify: `src/components/personality/HabitTracker.tsx:616-618` (`catchableHabits`)
- Modify: `src/components/personality/HabitTracker.tsx:626-637` (`pending`/`done`/`skipped`/`sortedHabits`/`keystoneCount`)
- Modify: `src/components/personality/HabitTracker.tsx:648` (`topStreak`)
- Modify: `src/components/personality/HabitTracker.tsx:713` (header "done today" count)
- Modify: `src/components/personality/HabitTracker.tsx:727-740` (empty states)
- Modify: `src/components/personality/HabitTracker.tsx:743` (keystone hint)

**Interfaces:**
- Consumes: `user_hidden_habits` table from Task 1 (columns `user_id`, `habit_id`).
- Produces: `hiddenHabitIds: Set<string>`, `visibleHabits: Habit[]` (all habits minus hidden globals), `hideGlobalHabit(habitId: string): Promise<void>`, `unhideGlobalHabit(habitId: string): Promise<void>`. Task 3 consumes all four to build the management modal and wire it into the header; `visibleHabits` replaces `habits` in every remaining render-facing read.

- [ ] **Step 1: Add the `HiddenMark` type**

In `src/components/personality/HabitTracker.tsx`, right after the existing `KeystoneMark` interface (lines 43-45):

```ts
interface KeystoneMark {
  habit_id: string
}
```

add:

```ts
interface KeystoneMark {
  habit_id: string
}

interface HiddenMark {
  habit_id: string
}
```

- [ ] **Step 2: Fetch the current user's hidden-habit marks and derive `visibleHabits`**

Right after the existing `globalKeystoneIds` block (lines 366-369):

```ts
  const globalKeystoneIds = useMemo(
    () => new Set(globalKeystoneMarks.map(k => k.habit_id)),
    [globalKeystoneMarks]
  )
```

add:

```ts
  const globalKeystoneIds = useMemo(
    () => new Set(globalKeystoneMarks.map(k => k.habit_id)),
    [globalKeystoneMarks]
  )

  const {
    data: hiddenHabitMarks, setData: setHiddenHabitMarks,
  } = useCachedQuery<HiddenMark[]>(
    'hidden-global-habits',
    (supabase, userId) => supabase
      .from('user_hidden_habits')
      .select('habit_id')
      .eq('user_id', userId),
    []
  )

  const hiddenHabitIds = useMemo(
    () => new Set(hiddenHabitMarks.map(h => h.habit_id)),
    [hiddenHabitMarks]
  )

  // habits minus any global habit this user has hidden — the source every
  // render-facing computation below should read from instead of `habits`.
  // `habits` itself stays unfiltered so the manage-global-habits modal (Task 3)
  // can still list and restore hidden ones.
  const visibleHabits = useMemo(
    () => habits.filter(h => !h.is_global || !hiddenHabitIds.has(h.id)),
    [habits, hiddenHabitIds]
  )
```

- [ ] **Step 3: Add `hideGlobalHabit` / `unhideGlobalHabit`**

Right after `toggleKeystone` (after its closing brace on line 613), add:

```ts
  async function hideGlobalHabit(habitId: string) {
    if (!userId) return
    setHiddenHabitMarks(prev => prev.some(h => h.habit_id === habitId) ? prev : [...prev, { habit_id: habitId }])
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_hidden_habits').insert({ user_id: userId, habit_id: habitId })
  }

  async function unhideGlobalHabit(habitId: string) {
    if (!userId) return
    setHiddenHabitMarks(prev => prev.filter(h => h.habit_id !== habitId))
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_hidden_habits').delete().eq('user_id', userId).eq('habit_id', habitId)
  }
```

- [ ] **Step 4: Route the keystone cap check in `toggleKeystone` through `visibleHabits`**

Replace, inside `toggleKeystone`:

```ts
    const alreadyKeystone = isKeystoneFor(habit)
    const keystoneCount = habits.filter(isKeystoneFor).length
    if (!alreadyKeystone && keystoneCount >= 2) return  // enforced in UI
```

with:

```ts
    const alreadyKeystone = isKeystoneFor(habit)
    const keystoneCount = visibleHabits.filter(isKeystoneFor).length
    if (!alreadyKeystone && keystoneCount >= 2) return  // enforced in UI
```

This means a global habit marked keystone and then hidden no longer occupies one of the user's 2 keystone slots while hidden — its keystone row is left untouched in `user_habit_keystones` and reappears automatically if the habit is restored (Task 3 verifies this round-trip).

- [ ] **Step 5: Route `catchableHabits` through `visibleHabits`**

Replace:

```ts
  const graceOpen = isGraceActive() && !yesterdayLogsOffline && !yesterdayLogsLoading
  const catchableHabits = graceOpen
    ? habits.filter(h => h.frequency === 'daily' && getStatus(h.id) !== 'done' && !yesterdayLogs.some(l => l.habit_id === h.id && l.status === 'done'))
    : []
```

with:

```ts
  const graceOpen = isGraceActive() && !yesterdayLogsOffline && !yesterdayLogsLoading
  const catchableHabits = graceOpen
    ? visibleHabits.filter(h => h.frequency === 'daily' && getStatus(h.id) !== 'done' && !yesterdayLogs.some(l => l.habit_id === h.id && l.status === 'done'))
    : []
```

- [ ] **Step 6: Route `pending`/`done`/`skipped`/`keystoneCount`/`topStreak` through `visibleHabits`**

Replace:

```ts
  // Keystone first, then pending, then done — skipped habits shown below
  const pending = habits.filter(h => getStatus(h.id) === 'pending')
  const done    = habits.filter(h => getStatus(h.id) === 'done')
  const skipped = habits.filter(h => getStatus(h.id) === 'missed')
  const sortedHabits = [
    ...pending.filter(h => isKeystoneFor(h)),
    ...pending.filter(h => !isKeystoneFor(h)),
    ...done.filter(h => isKeystoneFor(h)),
    ...done.filter(h => !isKeystoneFor(h)),
  ]

  const keystoneCount = habits.filter(isKeystoneFor).length
```

with:

```ts
  // Keystone first, then pending, then done — skipped habits shown below.
  // Sourced from visibleHabits (not habits) so a hidden global habit never renders.
  const pending = visibleHabits.filter(h => getStatus(h.id) === 'pending')
  const done    = visibleHabits.filter(h => getStatus(h.id) === 'done')
  const skipped = visibleHabits.filter(h => getStatus(h.id) === 'missed')
  const sortedHabits = [
    ...pending.filter(h => isKeystoneFor(h)),
    ...pending.filter(h => !isKeystoneFor(h)),
    ...done.filter(h => isKeystoneFor(h)),
    ...done.filter(h => !isKeystoneFor(h)),
  ]

  const keystoneCount = visibleHabits.filter(isKeystoneFor).length
```

Leave `habitWeight` (the line right after, reading `habits.find(...)`) unchanged — it resolves the weight of habits behind already-recorded `weekLogs` entries, which must keep working even for a habit hidden mid-week, since past logs/scoring are never touched by hiding.

Then replace:

```ts
  const topStreak  = habits.reduce((m, h) => Math.max(m, h.streak_count), 0)
```

with:

```ts
  const topStreak  = visibleHabits.reduce((m, h) => Math.max(m, h.streak_count), 0)
```

Leave the `completedHabitIds`/`completedHabits`/`avgCompletedStreak` block right after (still reading `habits`) unchanged — it derives the weekly streak bonus from `weekLogs`, i.e. from history, not from what's currently visible.

- [ ] **Step 7: Route the header count, empty states, and keystone hint through `visibleHabits`**

Replace:

```ts
          {habits.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {done.length}/{habits.length} done today
```

with:

```ts
          {visibleHabits.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {done.length}/{visibleHabits.length} done today
```

Replace:

```tsx
      {/* Empty state */}
      {habits.length === 0 && isOffline && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <Flame className="h-10 w-10 text-orange-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Can&apos;t load — you&apos;re offline.</p>
        </div>
      )}

      {habits.length === 0 && !isOffline && (
```

with:

```tsx
      {/* Empty state */}
      {visibleHabits.length === 0 && isOffline && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <Flame className="h-10 w-10 text-orange-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Can&apos;t load — you&apos;re offline.</p>
        </div>
      )}

      {visibleHabits.length === 0 && !isOffline && (
```

Replace:

```tsx
      {/* Keystone hint */}
      {keystoneCount < 2 && habits.length >= 2 && (
```

with:

```tsx
      {/* Keystone hint */}
      {keystoneCount < 2 && visibleHabits.length >= 2 && (
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Manual regression check (no way to hide anything yet — confirm nothing changed)**

Run: `npm run dev`, open `http://localhost:3000/personality/habits`.
- Confirm the tracker looks and behaves exactly as before: same habits shown, same counts, same "done today" ratio, same keystone hint threshold. Since `user_hidden_habits` has no rows yet for any user, `visibleHabits` is currently identical to `habits` everywhere — this step confirms that equivalence held through the refactor.

- [ ] **Step 10: Commit**

```bash
git add src/components/personality/HabitTracker.tsx
git commit -m "feat: add hidden-global-habits data layer (fetch, visibleHabits, hide/unhide)"
```

---

### Task 3: UI — "Manage Global Habits" modal, wired into the header

**Files:**
- Modify: `src/components/personality/HabitTracker.tsx:4-7` (icon imports)
- Modify: `src/components/personality/HabitTracker.tsx:258` (new component, right after `EditHabitModal`)
- Modify: `src/components/personality/HabitTracker.tsx:709-721` (header block)

**Interfaces:**
- Consumes: `hiddenHabitIds`, `visibleHabits`, `hideGlobalHabit`, `unhideGlobalHabit` from Task 2; `habits` (raw, unfiltered) already in scope.
- Produces: no new exports — this is the final task, closing out the feature end-to-end.

- [ ] **Step 1: Add the new icons**

Replace:

```ts
import {
  Flame, Plus, Trash2, Check, Loader2, AlertCircle,
  RotateCcw, XCircle, Trophy, Pencil, Crown, Globe, X,
} from 'lucide-react'
```

with:

```ts
import {
  Flame, Plus, Trash2, Check, Loader2, AlertCircle,
  RotateCcw, XCircle, Trophy, Pencil, Crown, Globe, X,
  Settings2, Eye, EyeOff,
} from 'lucide-react'
```

- [ ] **Step 2: Add the `ManageGlobalHabitsModal` component**

Right after `EditHabitModal`'s closing brace (after line 258, before the `// ─── Weekly Score Card ───` comment), add:

```tsx
// ─── Manage Global Habits Modal ──────────────────────────────

function ManageGlobalHabitsModal({
  globalHabits, hiddenIds, onHide, onUnhide,
}: {
  globalHabits: Habit[]
  hiddenIds: Set<string>
  onHide: (habitId: string) => Promise<void>
  onUnhide: (habitId: string) => Promise<void>
}) {
  const [open, setOpen]           = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function toggle(habit: Habit) {
    if (pendingId) return
    setPendingId(habit.id)
    if (hiddenIds.has(habit.id)) await onUnhide(habit.id)
    else await onHide(habit.id)
    setPendingId(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 gap-1.5">
          <Settings2 className="h-4 w-4" /> Manage Global
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Manage Global Habits</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">
          Hide habits you don&apos;t want to track. You can bring them back here anytime.
        </p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {globalHabits.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">No global habits yet.</p>
          )}
          {globalHabits.map(habit => {
            const hidden = hiddenIds.has(habit.id)
            return (
              <div key={habit.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                <span className={cn('text-sm truncate', hidden ? 'text-slate-500' : 'text-white')}>
                  {habit.habit_name}
                </span>
                <button
                  onClick={() => toggle(habit)}
                  disabled={pendingId === habit.id}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                    hidden
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-white/10 hover:bg-white/15 text-slate-300'
                  )}
                >
                  {pendingId === habit.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {hidden ? 'Restore' : 'Hide'}
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Wire the trigger into the header**

Replace:

```tsx
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Habit Tracker</h2>
          {visibleHabits.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {done.length}/{visibleHabits.length} done today
              {topStreak > 0 && ` · 🔥 Best streak: ${topStreak}`}
            </p>
          )}
        </div>
        <AddHabitModal onAdd={fetchData} />
      </div>
```

with:

```tsx
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Habit Tracker</h2>
          {visibleHabits.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {done.length}/{visibleHabits.length} done today
              {topStreak > 0 && ` · 🔥 Best streak: ${topStreak}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {habits.some(h => h.is_global) && (
            <ManageGlobalHabitsModal
              globalHabits={habits.filter(h => h.is_global)}
              hiddenIds={hiddenHabitIds}
              onHide={hideGlobalHabit}
              onUnhide={unhideGlobalHabit}
            />
          )}
          <AddHabitModal onAdd={fetchData} />
        </div>
      </div>
```

The "Manage Global" button only renders when at least one global habit exists at all (hidden or not) — no point showing a management screen with nothing in it.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors introduced by this file.

- [ ] **Step 5: Manual end-to-end verification**

Run: `npm run dev`, open `http://localhost:3000/personality/habits` (needs at least one global habit to exist — create one via the admin global-habits UI/API if none exist yet).

- Confirm a "Manage Global" button now appears in the header next to "Add Habit".
- Open it. Expected: every global habit is listed, each with a "Hide" button.
- Click "Hide" on one. Expected: its row updates to show "Restore" (violet), and after closing the modal, that habit no longer appears anywhere in the main tracker (card list, "done today" count, catch-up banner if applicable).
- Reload the page. Expected: the habit is still hidden (confirms the fetch + `visibleHabits` round-trip, not just the optimistic update). Open the modal again — it still shows "Restore" for that habit.
- In the Supabase dashboard's Table Editor, open `user_hidden_habits` and confirm a row exists for this user + habit.
- Mark a different global habit as keystone (crown button), then hide it via the modal. Expected: it disappears from the tracker and no longer counts toward the 2-keystone cap (test by marking a 3rd habit keystone — it should now be allowed). Restore the hidden habit. Expected: it reappears still marked keystone (crown icon, "Keystone" pill) — confirms `user_habit_keystones` was untouched by hiding.
- Click "Restore" on the first hidden habit. Expected: it reappears in the main tracker, and the `user_hidden_habits` row is deleted (re-check Table Editor).
- If a second test account is available, log in as that user (or an incognito window) and confirm the habit you hid is still fully visible for them — this is the core requirement (per-user isolation, no effect on other users).
- With everything restored, confirm the "Manage Global" list still renders correctly (all "Hide", none stuck on a spinner).

- [ ] **Step 6: Commit**

```bash
git add src/components/personality/HabitTracker.tsx
git commit -m "feat: let users hide/restore global habits from their tracker"
```
