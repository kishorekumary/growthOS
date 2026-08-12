# Backdating Challenge Check-ins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mark, unmark, or add a reflection to a missed day on their 90-day challenge within a 3-day grace window, instead of only being able to check in for today.

**Architecture:** Generalize `ChallengeDetail.tsx`'s `checkIn()` (hardcoded to `checkin_date: today`) into `saveCheckin(date, completed, reflection)`, keyed by an `isEditableDate(dateStr)` predicate (today, back to 3 days, within the challenge's day range). The existing heatmap grid's cells gain click handlers for editable dates, opening a new `DayEditModal` that reuses `saveCheckin`. The existing "Today's check-in" card is refactored to call the same function instead of duplicating the upsert logic, and gains an "Undo" button.

**Tech Stack:** Next.js App Router, React (client component), Supabase (Postgres + RLS, `@supabase/supabase-js` browser client), TypeScript, date-fns, lucide-react icons. No test framework is configured in this repo (zero `*.test.*`/`*.spec.*` files, no jest/vitest config) — verification is `npx tsc --noEmit` and manual browser testing via the dev server, matching how prior features in this file were verified (see `docs/superpowers/plans/2026-08-10-hide-global-habits.md`).

## Global Constraints

- A day is editable only if: its date is `<= today`, it's within 3 days of today (today, -1, -2, -3), and its computed day number falls within `1..totalDays`. This rule is independent of `challenge.status` — no per-status branching.
- Un-marking a day deletes its `challenge_checkins` row rather than writing `completed: false` — the table has never stored `completed: false` rows, and every read site (heatmap, streak calc, `completedCount`) already treats "no row" as not-done.
- The final-day auto-complete check (`status: 'completed'`) must key off the *edited* date's day number, not today's — this is what lets backfilling day `totalDays` fix an abandoned challenge, with no separate reactivation code path.
- No DB migration — `challenge_checkins` already supports arbitrary dates with no date-based constraint (spec: `docs/superpowers/specs/2026-08-12-challenge-backdated-checkins-design.md`).

---

### Task 1: Generalize the write path (`saveCheckin`, `isEditableDate`) and refactor Today's check-in card

**Files:**
- Modify: `src/components/challenges/ChallengeDetail.tsx:141-164` (replace `checkIn()`)
- Modify: `src/components/challenges/ChallengeDetail.tsx:334-372` (Today's check-in card)

**Interfaces:**
- Consumes: existing component-scope vars `today`, `startDate`, `totalDays`, `challenge`, `supabase`, `load`, `onComplete`, `saving`/`setSaving` (all already in scope in `ChallengeDetail`).
- Produces: `dayNumberForDate(dateStr: string): number`, `isEditableDate(dateStr: string): boolean`, `saveCheckin(date: string, completed: boolean, reflectionText: string): Promise<void>`. Task 2 consumes all three.

- [ ] **Step 1: Replace `checkIn()` with `dayNumberForDate`, `isEditableDate`, and `saveCheckin`**

In `src/components/challenges/ChallengeDetail.tsx`, replace:

```ts
  async function checkIn() {
    if (!isTodayInRange || saving) return
    setSaving(true)
    await supabase.from('challenge_checkins').upsert({
      challenge_id: challenge.id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      checkin_date: today,
      completed: true,
      reflection: reflection.trim() || null,
    }, { onConflict: 'challenge_id,checkin_date' })

    // Auto-complete challenge on the final day
    if (dayNumber >= totalDays) {
      await supabase
        .from('ninety_day_challenges')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', challenge.id)
      onComplete(challenge.id)
    }

    await load()
    setReflection('')
    setSaving(false)
  }
```

with:

```ts
  function dayNumberForDate(dateStr: string) {
    return differenceInDays(parseISO(dateStr), startDate) + 1
  }

  // A day can be marked/unmarked/edited if it's not in the future, it's
  // within 3 days of today (a grace window for catching up on missed days),
  // and it falls within the challenge's actual day range. Independent of
  // challenge.status so it behaves the same for active/abandoned/completed.
  function isEditableDate(dateStr: string) {
    if (dateStr > today) return false
    if (differenceInDays(parseISO(today), parseISO(dateStr)) > 3) return false
    const dn = dayNumberForDate(dateStr)
    return dn >= 1 && dn <= totalDays
  }

  async function saveCheckin(date: string, completed: boolean, reflectionText: string) {
    if (saving) return
    setSaving(true)
    if (completed) {
      await supabase.from('challenge_checkins').upsert({
        challenge_id: challenge.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        checkin_date: date,
        completed: true,
        reflection: reflectionText.trim() || null,
      }, { onConflict: 'challenge_id,checkin_date' })
    } else {
      await supabase.from('challenge_checkins')
        .delete()
        .eq('challenge_id', challenge.id)
        .eq('checkin_date', date)
    }

    // Auto-complete the challenge if the edited day is the final day — keyed
    // off the edited date, not "today", so backfilling day `totalDays` within
    // the grace window fixes an abandoned challenge by completing it.
    if (completed && dayNumberForDate(date) >= totalDays) {
      await supabase
        .from('ninety_day_challenges')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', challenge.id)
      onComplete(challenge.id)
    }

    await load()
    setSaving(false)
  }
```

- [ ] **Step 2: Refactor the Today's check-in card to use `saveCheckin`, add "Undo"**

Replace:

```tsx
      {/* Today's check-in */}
      {isTodayInRange && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
          {todayCheckin?.completed ? (
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Day {dayNumber} complete!</p>
                {todayCheckin.reflection && (
                  <p className="text-xs text-slate-500 mt-0.5 italic">"{todayCheckin.reflection}"</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Day {dayNumber} Check-in</p>
              {challenge.daily_commitment && (
                <p className="text-xs text-slate-500">Today: <span className="text-slate-400">{challenge.daily_commitment}</span></p>
              )}
              <textarea
                value={reflection}
                onChange={e => setReflection(e.target.value)}
                placeholder="Quick reflection (optional)…"
                rows={2}
                className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-purple-500/40 resize-none"
              />
              <button
                onClick={checkIn}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: catColor + 'cc' }}
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? 'Saving…' : 'Mark day complete'}
              </button>
            </>
          )}
        </div>
      )}
```

with:

```tsx
      {/* Today's check-in */}
      {isTodayInRange && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
          {todayCheckin?.completed ? (
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-400">Day {dayNumber} complete!</p>
                {todayCheckin.reflection && (
                  <p className="text-xs text-slate-500 mt-0.5 italic">"{todayCheckin.reflection}"</p>
                )}
              </div>
              <button
                onClick={() => saveCheckin(today, false, '')}
                disabled={saving}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors underline decoration-dotted disabled:opacity-50"
              >
                Undo
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Day {dayNumber} Check-in</p>
              {challenge.daily_commitment && (
                <p className="text-xs text-slate-500">Today: <span className="text-slate-400">{challenge.daily_commitment}</span></p>
              )}
              <textarea
                value={reflection}
                onChange={e => setReflection(e.target.value)}
                placeholder="Quick reflection (optional)…"
                rows={2}
                className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-purple-500/40 resize-none"
              />
              <button
                onClick={async () => { await saveCheckin(today, true, reflection); setReflection('') }}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: catColor + 'cc' }}
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? 'Saving…' : 'Mark day complete'}
              </button>
            </>
          )}
        </div>
      )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`checkIn` no longer exists — confirms no other file referenced it; `ChallengeDetail` is only used from `ChallengeApp.tsx`, which never calls `checkIn` directly.)

- [ ] **Step 4: Manual verification — today's check-in still works, plus Undo**

Run: `npm run dev`, open the challenges page, open (or create) an active challenge.

- Confirm "Mark day complete" still works exactly as before: type a reflection, click it, the card flips to the green "Day N complete!" state showing the reflection.
- Confirm a new "Undo" text link now appears next to the completed state. Click it. Expected: the card reverts to the check-in form (reflection field empty), and the heatmap cell for today reverts from done-color to the "today" ring style.
- Reload the page after undoing. Expected: still reverted (confirms the row was actually deleted, not just hidden client-side).

- [ ] **Step 5: Commit**

```bash
git add src/components/challenges/ChallengeDetail.tsx
git commit -m "refactor: generalize challenge check-in write path to any date"
```

---

### Task 2: Heatmap click-to-edit past days (`DayEditModal`)

**Files:**
- Modify: `src/components/challenges/ChallengeDetail.tsx:96` (new `editingDate` state)
- Modify: `src/components/challenges/ChallengeDetail.tsx:222-228` (render `DayEditModal` alongside `EditChallengeModal`)
- Modify: `src/components/challenges/ChallengeDetail.tsx:276-300` (heatmap cell `onClick`/styling)
- Modify: `src/components/challenges/ChallengeDetail.tsx` (add `DayEditModal` component at end of file, after `EditChallengeModal`)

**Interfaces:**
- Consumes: `isEditableDate`, `dayNumberForDate`, `saveCheckin`, `saving`, `checkins`, `Checkin` type (all from Task 1 / already in file).
- Produces: no new exports — this closes out the feature.

- [ ] **Step 1: Add `editingDate` state**

Replace:

```ts
  const [editOpen, setEditOpen] = useState(false)
```

with:

```ts
  const [editOpen, setEditOpen] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
```

- [ ] **Step 2: Render `DayEditModal` next to `EditChallengeModal`**

Replace:

```tsx
      {editOpen && (
        <EditChallengeModal
          challenge={challenge}
          onClose={() => setEditOpen(false)}
          onSaved={updated => { onUpdate(updated); setEditOpen(false) }}
        />
      )}
```

with:

```tsx
      {editOpen && (
        <EditChallengeModal
          challenge={challenge}
          onClose={() => setEditOpen(false)}
          onSaved={updated => { onUpdate(updated); setEditOpen(false) }}
        />
      )}

      {editingDate && (
        <DayEditModal
          date={editingDate}
          dayNumber={dayNumberForDate(editingDate)}
          checkin={checkins[editingDate]}
          saving={saving}
          onSave={async (completed, reflectionText) => {
            await saveCheckin(editingDate, completed, reflectionText)
            setEditingDate(null)
          }}
          onClose={() => setEditingDate(null)}
        />
      )}
```

- [ ] **Step 3: Make editable heatmap cells clickable**

Replace:

```tsx
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
          {Array.from({ length: totalDays }, (_, i) => {
            const dateStr = format(addDays(startDate, i), 'yyyy-MM-dd')
            const isFuture = dateStr > today
            const isToday  = dateStr === today
            const isDone   = checkins[dateStr]?.completed
            const isMilestone = MILESTONES.includes(i + 1)

            let bg = 'bg-white/5'
            let style: React.CSSProperties | undefined
            if (isDone) { style = { backgroundColor: catColor + '99' }; bg = '' }
            else if (!isFuture && !isToday) bg = 'bg-red-500/15'

            return (
              <div
                key={i}
                title={`Day ${i + 1} · ${dateStr}`}
                className={`aspect-square rounded-sm transition-all ${bg} ${
                  isToday && !isDone ? 'ring-1 ring-white/40' : ''
                } ${isMilestone && !isDone && !isFuture ? 'ring-1 ring-yellow-500/40' : ''}`}
                style={style}
              />
            )
          })}
        </div>
```

with:

```tsx
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
          {Array.from({ length: totalDays }, (_, i) => {
            const dateStr = format(addDays(startDate, i), 'yyyy-MM-dd')
            const isFuture = dateStr > today
            const isToday  = dateStr === today
            const isDone   = checkins[dateStr]?.completed
            const isMilestone = MILESTONES.includes(i + 1)
            const editable = isEditableDate(dateStr)

            let bg = 'bg-white/5'
            let style: React.CSSProperties | undefined
            if (isDone) { style = { backgroundColor: catColor + '99' }; bg = '' }
            else if (!isFuture && !isToday) bg = 'bg-red-500/15'

            return (
              <div
                key={i}
                title={`Day ${i + 1} · ${dateStr}`}
                onClick={editable ? () => setEditingDate(dateStr) : undefined}
                className={`aspect-square rounded-sm transition-all ${bg} ${
                  isToday && !isDone ? 'ring-1 ring-white/40' : ''
                } ${isMilestone && !isDone && !isFuture ? 'ring-1 ring-yellow-500/40' : ''} ${
                  editable ? 'cursor-pointer hover:ring-1 hover:ring-white/50' : ''
                }`}
                style={style}
              />
            )
          })}
        </div>
```

- [ ] **Step 4: Add the `DayEditModal` component**

At the end of `src/components/challenges/ChallengeDetail.tsx`, after `EditChallengeModal`'s closing brace, add:

```tsx

// ─── Day Edit Modal ─────────────────────────────────────────────

function DayEditModal({ date, dayNumber, checkin, saving, onSave, onClose }: {
  date: string
  dayNumber: number
  checkin: Checkin | undefined
  saving: boolean
  onSave: (completed: boolean, reflection: string) => Promise<void>
  onClose: () => void
}) {
  const [reflection, setReflection] = useState(checkin?.reflection ?? '')

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Day {dayNumber} · {format(parseISO(date), 'MMM d')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <textarea
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="Quick reflection (optional)…"
            rows={3}
            className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-purple-500/40 resize-none"
          />
          <div className="flex gap-2">
            {checkin?.completed ? (
              <>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={saving}
                  onClick={() => onSave(true, reflection)}
                >
                  Save reflection
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 text-slate-300"
                  disabled={saving}
                  onClick={() => onSave(false, reflection)}
                >
                  Mark incomplete
                </Button>
              </>
            ) : (
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={saving}
                onClick={() => onSave(true, reflection)}
              >
                Mark complete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

`Checkin`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`, and `Button` are all already imported/defined earlier in this same file (`Checkin` interface at the top, UI components at the top imports) — no new imports needed.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual end-to-end verification**

Run: `npm run dev`, open the challenges page.

- On an active challenge, skip checking in "today" and instead let a day or two pass (or, for a faster check, temporarily eyeball a challenge whose `start_date` is a few days in the past with gaps in `challenge_checkins` via Supabase Table Editor). Confirm:
  - A missed day within the last 3 days shows a hover ring and pointer cursor on the heatmap; a missed day older than 3 days does not.
  - A future day has no click affordance.
  - Clicking an editable missed day opens the modal titled "Day N · <date>" with a "Mark complete" button.
  - Add a reflection, click "Mark complete". Expected: modal closes, the heatmap cell turns to the done color, and `completedCount`/streak/rate on the hero card update.
  - Reopen that same cell. Expected: modal now shows the saved reflection and a "Mark incomplete" button (plus "Save reflection"). Click "Mark incomplete". Expected: modal closes, cell reverts to missed/red. Reload the page — confirm it stays reverted.
- Find or create a challenge that has run past its `duration_days` with no final check-in (shows in the "Abandoned" bucket on the list view — or set a short `duration_days` like 3 and let 4-5 days pass via a test challenge with an old `start_date`). Open it, click day `totalDays` in the heatmap (should still be within the 3-day grace window), mark it complete. Expected: the challenge moves from `Abandoned` to `Completed` (verify on the list view, and via `status` in the Supabase Table Editor).
- Confirm the Task 1 behavior (today's card + Undo) still works unchanged after this task's edits.

- [ ] **Step 7: Commit**

```bash
git add src/components/challenges/ChallengeDetail.tsx
git commit -m "feat: let users backdate challenge check-ins within a 3-day grace window"
```
