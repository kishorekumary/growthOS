# Habit Grace Period + Completion Celebration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mark a daily habit done for "yesterday" (preserving the streak) up until local noon today, and play a coin-toss animation + synthesized sound whenever any habit is marked done.

**Architecture:** Consolidate the three copy-pasted `computeStreak`/`todayStr` implementations into one shared `src/lib/habitStreak.ts`, extended with a `referenceDate` parameter and grace-window helpers. A dismissible "missed yesterday" banner (backed by a new `habit_logs` query for yesterday's date) appears in `HabitTracker.tsx` and `QuickLog.tsx`'s `HabitPanel`, each with its own catch-up completion function that reuses the shared streak logic. A new `useHabitCelebration()` hook renders a hand-rolled `CoinBurst` component (via `createPortal`) and plays a Web Audio–synthesized chime; it's wired into all three existing mark-done call sites (`HabitTracker.markDone`, `QuickLog.HabitPanel.markDone`, `QuickLog.VoicePanel.confirmLog`'s habit branch) plus both new catch-up functions.

**Tech Stack:** Next.js App Router, React client components, Supabase (Postgres, browser client), Tailwind CSS + plain CSS keyframes in `globals.css`, Web Audio API. No new npm dependencies. No test framework exists in this repo (confirmed: no jest/vitest/`*.test.*` files) — verification is `npx tsc --noEmit`, a full `next build`, small throwaway Node scripts for pure-logic functions (written to `/tmp`, deleted after use), and manual reasoning, consistent with how every other feature in this codebase has been verified.

## Global Constraints

- No new dependencies — build with what's already installed (`lucide-react`, `createSupabaseBrowserClient`, existing `cn` util, plain Web Audio API, hand-rolled CSS keyframes).
- No schema changes / no new migrations — `habit_logs.log_date` and `personality_habits.streak_count`/`last_done_at` already support backdated writes.
- Follow existing conventions exactly: `'use client'` components use `createSupabaseBrowserClient()` from `@/lib/supabase`; optimistic local-state updates before/alongside the Supabase write, matching the existing `markDone`/`markMissed`/`undoLog` pattern in `HabitTracker.tsx`.
- Grace deadline uses the browser's local device time (not `notification_settings.timezone`), per explicit design decision.
- Global habits (`is_global: true`) skip `personality_habits` writes (shared row, no per-user streak), same as existing `markDone`/`undoLog` — this only applies in `HabitTracker.tsx`; `QuickLog.tsx`'s `HabitPanel`/`VoicePanel` never load global habits at all (their queries filter `.eq('user_id', userId)` with no `is_global` clause), so no such branch is needed there.
- Voice logging (`VoicePanel`) gets the celebration effect but NOT the grace catch-up banner — it stays "today only," per the approved spec.
- Spec reference: `docs/superpowers/specs/2026-07-26-habit-grace-period-celebration-design.md`.

---

### Task 1: Shared habit streak + grace-window logic

**Files:**
- Create: `src/lib/habitStreak.ts`

**Interfaces:**
- Produces: `type Frequency = 'daily' | 'weekly'`, `localDateStr(d?: Date): string`, `todayStr(): string`, `yesterdayStr(): string`, `computeStreak(current: number, lastDoneAt: string | null, frequency: Frequency, referenceDate?: Date): number`, `graceDeadlineToday(now?: Date): Date`, `isGraceActive(now?: Date): boolean`. Tasks 2, 3, 9, 10 import all of these.

- [ ] **Step 1: Write the file**

```ts
export type Frequency = 'daily' | 'weekly'

export function localDateStr(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export function todayStr(): string {
  return localDateStr()
}

export function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateStr(d)
}

// Returns the updated streak count for a habit just marked done, evaluated
// as of referenceDate (defaults to now). Pass yesterday's Date to compute a
// grace-period catch-up completion instead of a normal "today" completion.
export function computeStreak(
  current: number,
  lastDoneAt: string | null,
  frequency: Frequency,
  referenceDate: Date = new Date()
): number {
  if (!lastDoneAt) return 1
  const last = new Date(lastDoneAt)
  last.setHours(0, 0, 0, 0)
  const ref = new Date(referenceDate)
  ref.setHours(0, 0, 0, 0)
  const diffDays = Math.round((ref.getTime() - last.getTime()) / 86400000)
  if (frequency === 'daily') {
    if (diffDays === 0) return current
    if (diffDays === 1) return current + 1
    return 1
  }
  if (diffDays === 0) return current
  if (diffDays <= 7) return current + 1
  return 1
}

// Grace deadline for catching up *yesterday's* habit: local noon today.
export function graceDeadlineToday(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  return d
}

export function isGraceActive(now: Date = new Date()): boolean {
  return now.getTime() < graceDeadlineToday(now).getTime()
}
```

- [ ] **Step 2: Verify with a throwaway script**

There's no test runner in this repo, so verify with a plain Node script (no TS syntax, so it runs directly) and delete it afterward.

```bash
cat > /tmp/verify-habit-streak.mjs << 'EOF'
function computeStreak(current, lastDoneAt, frequency, referenceDate = new Date()) {
  if (!lastDoneAt) return 1
  const last = new Date(lastDoneAt); last.setHours(0, 0, 0, 0)
  const ref  = new Date(referenceDate); ref.setHours(0, 0, 0, 0)
  const diffDays = Math.round((ref.getTime() - last.getTime()) / 86400000)
  if (frequency === 'daily') {
    if (diffDays === 0) return current
    if (diffDays === 1) return current + 1
    return 1
  }
  if (diffDays === 0) return current
  if (diffDays <= 7) return current + 1
  return 1
}
function graceDeadlineToday(now = new Date()) {
  const d = new Date(now); d.setHours(12, 0, 0, 0); return d
}
function isGraceActive(now = new Date()) {
  return now.getTime() < graceDeadlineToday(now).getTime()
}

let ok = true
function check(name, got, expected) {
  if (got !== expected) { console.log(`FAIL ${name}: expected=${expected} got=${got}`); ok = false }
}

// computeStreak: same-day math as before (no lastDoneAt -> 1)
check('no lastDoneAt', computeStreak(5, null, 'daily'), 1)
// daily: done again same reference day -> unchanged
check('daily same day', computeStreak(3, '2026-07-20T10:00:00.000Z', 'daily', new Date('2026-07-20T18:00:00.000Z')), 3)
// daily: done next reference day -> +1
check('daily next day', computeStreak(3, '2026-07-20T10:00:00.000Z', 'daily', new Date('2026-07-21T09:00:00.000Z')), 4)
// daily: 2+ day gap -> reset to 1
check('daily gap resets', computeStreak(3, '2026-07-18T10:00:00.000Z', 'daily', new Date('2026-07-21T09:00:00.000Z')), 1)
// catch-up use: lastDoneAt was 2 days before "today", but referenceDate = yesterday (1 day gap) -> +1
const today     = new Date('2026-07-21T09:00:00.000Z')
const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
check('catch-up for yesterday extends streak', computeStreak(3, '2026-07-19T10:00:00.000Z', 'daily', yesterday), 4)

// grace window
const noonToday    = new Date('2026-07-21T12:00:00')
const beforeNoon    = new Date('2026-07-21T11:59:00')
const afterNoon     = new Date('2026-07-21T12:01:00')
check('grace active just before noon', isGraceActive(beforeNoon), true)
check('grace inactive just after noon', isGraceActive(afterNoon), false)
check('grace inactive exactly at noon', isGraceActive(noonToday), false)

console.log(ok ? 'ALL PASS' : 'FAILURES ABOVE')
EOF
node /tmp/verify-habit-streak.mjs
rm /tmp/verify-habit-streak.mjs
```

Expected output: `ALL PASS`. If not, fix `src/lib/habitStreak.ts` (logic under test is copy-identical — keep in sync while debugging, then delete the script).

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/habitStreak.ts
git commit -m "feat: add shared habit streak and grace-window logic"
```

---

### Task 2: Migrate HabitTracker.tsx to the shared streak logic

**Files:**
- Modify: `src/components/personality/HabitTracker.tsx`

**Interfaces:**
- Consumes: `computeStreak`, `localDateStr`, `todayStr` from `@/lib/habitStreak` (Task 1).

- [ ] **Step 1: Add the import**

Add near the top of `src/components/personality/HabitTracker.tsx`, alongside the existing imports:

```ts
import { computeStreak, localDateStr, todayStr } from '@/lib/habitStreak'
```

- [ ] **Step 2: Delete the duplicated `localDateStr`/`todayStr`/`computeStreak`**

Replace this block (lines 47-96):

```ts
function localDateStr(d = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function todayStr() { return localDateStr() }

function readTodayMissed(): string[] {
  try { return JSON.parse(localStorage.getItem(`habit_missed_${todayStr()}`) ?? '[]') } catch { return [] }
}
function writeTodayMissed(ids: string[]) {
  try {
    const key = `habit_missed_${todayStr()}`
    if (ids.length) localStorage.setItem(key, JSON.stringify(ids))
    else localStorage.removeItem(key)
  } catch {}
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay() || 7    // Mon=1 … Sun=7
  d.setDate(d.getDate() - (day - 1))
  return localDateStr(d)
}

// Mon=1 … Sun=7 in local time
function daysElapsedThisWeek(): number {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}

function computeStreak(current: number, lastDoneAt: string | null, frequency: Frequency): number {
  if (!lastDoneAt) return 1
  const last = new Date(lastDoneAt)
  last.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000)
  if (frequency === 'daily') {
    if (diffDays === 0) return current
    if (diffDays === 1) return current + 1
    return 1
  }
  if (diffDays === 0) return current
  if (diffDays <= 7) return current + 1
  return 1
}
```

with:

```ts
function readTodayMissed(): string[] {
  try { return JSON.parse(localStorage.getItem(`habit_missed_${todayStr()}`) ?? '[]') } catch { return [] }
}
function writeTodayMissed(ids: string[]) {
  try {
    const key = `habit_missed_${todayStr()}`
    if (ids.length) localStorage.setItem(key, JSON.stringify(ids))
    else localStorage.removeItem(key)
  } catch {}
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay() || 7    // Mon=1 … Sun=7
  d.setDate(d.getDate() - (day - 1))
  return localDateStr(d)
}

// Mon=1 … Sun=7 in local time
function daysElapsedThisWeek(): number {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}
```

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output. This confirms `markDone`'s existing call `computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)` still type-checks against the imported version's 3-required-arg signature (the 4th `referenceDate` param is optional).

- [ ] **Step 4: Commit**

```bash
git add src/components/personality/HabitTracker.tsx
git commit -m "refactor: HabitTracker uses shared habitStreak logic"
```

---

### Task 3: Migrate QuickLog.tsx to the shared streak logic

**Files:**
- Modify: `src/components/shared/QuickLog.tsx`

**Interfaces:**
- Consumes: `computeStreak`, `todayStr` from `@/lib/habitStreak` (Task 1).

- [ ] **Step 1: Add the import**

Add near the top of `src/components/shared/QuickLog.tsx`, alongside the existing imports:

```ts
import { computeStreak, todayStr } from '@/lib/habitStreak'
```

- [ ] **Step 2: Delete the duplicated `todayStr`/`computeStreak`**

Replace this block (lines 35-53):

```ts
function todayStr() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function computeStreak(current: number, lastDoneAt: string | null, freq: 'daily' | 'weekly'): number {
  if (!lastDoneAt) return 1
  const last  = new Date(lastDoneAt); last.setHours(0, 0, 0, 0)
  const today = new Date();           today.setHours(0, 0, 0, 0)
  const diff  = Math.round((today.getTime() - last.getTime()) / 86400000)
  if (freq === 'daily') {
    if (diff === 0) return current
    if (diff === 1) return current + 1
    return 1
  }
  if (diff === 0) return current
  if (diff <= 7)  return current + 1
  return 1
}
```

with nothing (delete both functions entirely — both call sites, `HabitPanel` and `VoicePanel`, use the imported versions).

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/QuickLog.tsx
git commit -m "refactor: QuickLog uses shared habitStreak logic"
```

---

### Task 4: Coin-burst visual component

**Files:**
- Create: `src/components/shared/CoinBurst.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: default-export `CoinBurst` component (no props). Task 5 renders it.

- [ ] **Step 1: Add the keyframes to globals.css**

Append to the end of `src/app/globals.css` (after the existing `.rich-editor p.is-empty:first-child::before { ... }` block):

```css

/* ── Habit completion celebration ────────────────────────────────── */
@keyframes coin-burst-fall {
  0% {
    transform: translate(-50%, -50%) translateY(0) rotate(0deg);
    opacity: 1;
  }
  30% {
    transform: translate(-50%, -50%) translate(var(--coin-left), -60px) rotate(calc(var(--coin-rotate) * 0.3));
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) translate(var(--coin-left), 220px) rotate(var(--coin-rotate));
    opacity: 0;
  }
}

.coin-burst-item {
  animation-name: coin-burst-fall;
  animation-timing-function: ease-in;
  animation-fill-mode: forwards;
}

@keyframes coin-burst-pulse {
  0%   { transform: scale(0.6); opacity: 0; }
  40%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.coin-burst-pulse {
  animation: coin-burst-pulse 0.4s ease-out forwards;
}
```

- [ ] **Step 2: Write the component**

```tsx
'use client'

import { useEffect, useState, type CSSProperties } from 'react'

interface Coin {
  id: number
  left: number     // horizontal drift, in px
  rotate: number    // deg
  delay: number     // s
  duration: number  // s
}

const COIN_COUNT = 14

function randomCoins(): Coin[] {
  return Array.from({ length: COIN_COUNT }, (_, id) => ({
    id,
    left: Math.round((Math.random() - 0.5) * 220),   // -110px .. +110px
    rotate: Math.round(Math.random() * 720 - 360),    // -360deg .. +360deg
    delay: Math.round(Math.random() * 150) / 1000,    // 0 .. 0.15s
    duration: 0.9 + Math.random() * 0.5,              // 0.9 .. 1.4s
  }))
}

interface CoinStyle extends CSSProperties {
  '--coin-left': string
  '--coin-rotate': string
}

export default function CoinBurst() {
  const [coins] = useState<Coin[]>(randomCoins)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  if (reducedMotion) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center">
        <span className="coin-burst-pulse text-4xl">✅</span>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[300] overflow-hidden">
      {coins.map(coin => (
        <span
          key={coin.id}
          className="coin-burst-item absolute left-1/2 top-1/2 text-2xl"
          style={{
            '--coin-left': `${coin.left}px`,
            '--coin-rotate': `${coin.rotate}deg`,
            animationDelay: `${coin.delay}s`,
            animationDuration: `${coin.duration}s`,
          } as CoinStyle}
        >
          🪙
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CoinBurst.tsx src/app/globals.css
git commit -m "feat: add hand-rolled coin-burst celebration component"
```

---

### Task 5: Celebration hook (sound + portal)

**Files:**
- Create: `src/hooks/useHabitCelebration.tsx` (`.tsx`, not `.ts` — the file returns JSX via `createPortal`)

**Interfaces:**
- Consumes: default-export `CoinBurst` from `@/components/shared/CoinBurst` (Task 4).
- Produces: `useHabitCelebration(): { celebrate: () => void; celebrationNode: React.ReactNode }`. Tasks 6, 7, 8, 9, 10 call this.

- [ ] **Step 1: Write the hook**

```tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CoinBurst from '@/components/shared/CoinBurst'

const CELEBRATION_DURATION_MS = 1500

// Synthesizes a short two-tone "cha-ching" chime with the Web Audio API —
// no audio asset file, no new dependency. Silently no-ops if Web Audio
// isn't available or playback is blocked.
function playCoinChime() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const AudioCtx = w.AudioContext ?? w.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    function blip(freq: number, start: number, dur: number) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + start)
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.25, now + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur)
    }

    blip(1046.5, 0,    0.12) // C6
    blip(1568.0, 0.09, 0.18) // G6

    setTimeout(() => ctx.close(), 500)
  } catch {
    // Audio unavailable/blocked — the visual burst still plays.
  }
}

export function useHabitCelebration() {
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const celebrate = useCallback(() => {
    playCoinChime()
    setActive(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setActive(false), CELEBRATION_DURATION_MS)
  }, [])

  const celebrationNode = active && typeof document !== 'undefined'
    ? createPortal(<CoinBurst />, document.body)
    : null

  return { celebrate, celebrationNode }
}
```

- [ ] **Step 2: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHabitCelebration.tsx
git commit -m "feat: add useHabitCelebration hook for coin burst + sound"
```

---

### Task 6: Wire celebration into HabitTracker.tsx

**Files:**
- Modify: `src/components/personality/HabitTracker.tsx`

**Interfaces:**
- Consumes: `useHabitCelebration` from `@/hooks/useHabitCelebration` (Task 5).

- [ ] **Step 1: Add the import**

```ts
import { useHabitCelebration } from '@/hooks/useHabitCelebration'
```

- [ ] **Step 2: Call the hook inside the component**

Inside `export default function HabitTracker() {`, add alongside the existing `useState` calls:

```ts
  const { celebrate, celebrationNode } = useHabitCelebration()
```

- [ ] **Step 3: Fire it on successful mark-done**

In `markDone`, change:

```ts
    // If habit_logs table missing, mark as unavailable so fallback kicks in
    if (logsRes.error) setLogsUnavail(true)
    setMarkingId(null)
  }
```

to:

```ts
    // If habit_logs table missing, mark as unavailable so fallback kicks in
    if (logsRes.error) setLogsUnavail(true)
    else celebrate()
    setMarkingId(null)
  }
```

- [ ] **Step 4: Render the celebration node**

In the component's returned JSX, add `{celebrationNode}` as the first child of the outer `<div className="space-y-4">`:

```tsx
  return (
    <div className="space-y-4">
      {celebrationNode}

      {/* Edit modal (controlled) */}
```

- [ ] **Step 5: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/personality/HabitTracker.tsx
git commit -m "feat: celebrate habit completions in HabitTracker"
```

---

### Task 7: Wire celebration into QuickLog.tsx's HabitPanel

**Files:**
- Modify: `src/components/shared/QuickLog.tsx`

**Interfaces:**
- Consumes: `useHabitCelebration` from `@/hooks/useHabitCelebration` (Task 5).

- [ ] **Step 1: Add the import**

Add alongside the other imports at the top of `src/components/shared/QuickLog.tsx`:

```ts
import { useHabitCelebration } from '@/hooks/useHabitCelebration'
```

- [ ] **Step 2: Call the hook inside HabitPanel**

Inside `function HabitPanel() {`, add alongside its existing `useState` calls:

```ts
  const { celebrate, celebrationNode } = useHabitCelebration()
```

- [ ] **Step 3: Fire it on successful mark-done**

In `HabitPanel`'s `markDone`, change:

```ts
      supabase.from('habit_logs').upsert(
        { user_id: userId, habit_id: habit.id, log_date: today, status: 'done' },
        { onConflict: 'habit_id,log_date' }
      ),
    ])
    setMarkingId(null)
  }
```

to:

```ts
      supabase.from('habit_logs').upsert(
        { user_id: userId, habit_id: habit.id, log_date: today, status: 'done' },
        { onConflict: 'habit_id,log_date' }
      ),
    ])
    celebrate()
    setMarkingId(null)
  }
```

- [ ] **Step 4: Render the celebration node**

In `HabitPanel`'s returned JSX, add `{celebrationNode}` as the first child of the outer `<div className="space-y-3">`:

```tsx
  return (
    <div className="space-y-3">
      {celebrationNode}
      <p className="text-xs text-center text-slate-500">
```

- [ ] **Step 5: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/QuickLog.tsx
git commit -m "feat: celebrate habit completions in QuickLog HabitPanel"
```

---

### Task 8: Wire celebration into QuickLog.tsx's VoicePanel

**Files:**
- Modify: `src/components/shared/QuickLog.tsx`

**Interfaces:**
- Consumes: `useHabitCelebration` from `@/hooks/useHabitCelebration` (already imported in Task 7, same file).

- [ ] **Step 1: Call the hook inside VoicePanel**

Inside `function VoicePanel({ onDone }: { onDone: () => void }) {`, add alongside its existing `useState` calls:

```ts
  const { celebrate, celebrationNode } = useHabitCelebration()
```

- [ ] **Step 2: Fire it in the habit branch of confirmLog**

Change:

```ts
      } else if (result.type === 'habit' && matchedHabit) {
        const h         = matchedHabit
        const newStreak = computeStreak(h.streak_count, h.last_done_at, h.frequency)
        const now       = new Date().toISOString()
        await Promise.all([
          supabase.from('personality_habits').update({
            streak_count:   newStreak,
            longest_streak: Math.max(newStreak, h.longest_streak),
            last_done_at:   now,
            updated_at:     now,
          }).eq('id', h.id),
          supabase.from('habit_logs').upsert(
            { user_id: uid, habit_id: h.id, log_date: today, status: 'done' },
            { onConflict: 'habit_id,log_date' }
          ),
        ])
      } else if (result.type === 'journal') {
```

to:

```ts
      } else if (result.type === 'habit' && matchedHabit) {
        const h         = matchedHabit
        const newStreak = computeStreak(h.streak_count, h.last_done_at, h.frequency)
        const now       = new Date().toISOString()
        await Promise.all([
          supabase.from('personality_habits').update({
            streak_count:   newStreak,
            longest_streak: Math.max(newStreak, h.longest_streak),
            last_done_at:   now,
            updated_at:     now,
          }).eq('id', h.id),
          supabase.from('habit_logs').upsert(
            { user_id: uid, habit_id: h.id, log_date: today, status: 'done' },
            { onConflict: 'habit_id,log_date' }
          ),
        ])
        celebrate()
      } else if (result.type === 'journal') {
```

- [ ] **Step 3: Render the celebration node**

`VoicePanel` has several early `return` statements for different `state` values (`unsupported`, `done`, `error`) before its main return. Add `{celebrationNode}` to the main returned JSX (the one starting `<div className="space-y-5">` near the end of the component), as its first child:

```tsx
  return (
    <div className="space-y-5">
      {celebrationNode}
      {/* Instruction */}
```

- [ ] **Step 4: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/QuickLog.tsx
git commit -m "feat: celebrate habit completions in QuickLog VoicePanel"
```

---

### Task 9: Grace catch-up banner in HabitTracker.tsx

**Files:**
- Modify: `src/components/personality/HabitTracker.tsx`

**Interfaces:**
- Consumes: `yesterdayStr`, `isGraceActive` from `@/lib/habitStreak` (Task 1); `X` icon from `lucide-react`.

- [ ] **Step 1: Extend the imports**

Change:

```ts
import { computeStreak, localDateStr, todayStr } from '@/lib/habitStreak'
```

to:

```ts
import { computeStreak, localDateStr, todayStr, yesterdayStr, isGraceActive } from '@/lib/habitStreak'
```

Change:

```ts
import {
  Flame, Plus, Trash2, Check, Loader2, AlertCircle,
  RotateCcw, XCircle, Trophy, Pencil, Crown, Globe,
} from 'lucide-react'
```

to:

```ts
import {
  Flame, Plus, Trash2, Check, Loader2, AlertCircle,
  RotateCcw, XCircle, Trophy, Pencil, Crown, Globe, X,
} from 'lucide-react'
```

- [ ] **Step 2: Add state and a yesterday-logs query**

Inside `export default function HabitTracker() {`, add alongside the existing `useState` calls:

```ts
  const [bannerExpanded, setBannerExpanded]     = useState(false)
  const [bannerDismissed, setBannerDismissedRaw] = useState(false)
  const [catchUpId, setCatchUpId]               = useState<string | null>(null)
```

Immediately after the existing `useEffect` that resolves `userId` (the one calling `.auth.getSession()`), add a second `useEffect` reading the dismissal flag:

```ts
  useEffect(() => {
    try { setBannerDismissedRaw(localStorage.getItem(`habit_grace_dismissed_${todayStr()}`) === '1') } catch {}
  }, [])
```

Immediately after the existing `weekLogs` block (the `useCachedQuery` call assigned to `weekLogs`/`setWeekLogs`), add a second query for yesterday's logs:

```ts
  const yesterday = yesterdayStr()
  const {
    data: yesterdayLogs, isOffline: yesterdayLogsOffline, setData: setYesterdayLogs,
  } = useCachedQuery<HabitLog[]>(
    `habit-logs:${yesterday}`,
    (supabase, userId) => supabase
      .from('habit_logs')
      .select('habit_id, log_date, status')
      .eq('user_id', userId)
      .eq('log_date', yesterday),
    [],
    [yesterday]
  )
```

- [ ] **Step 3: Add the catch-up completion function**

Add this new function directly after `markDone` (before `markMissed`):

```ts
  function dismissBanner() {
    setBannerDismissedRaw(true)
    try { localStorage.setItem(`habit_grace_dismissed_${todayStr()}`, '1') } catch {}
  }

  async function markDoneForYesterday(habit: Habit) {
    if (catchUpId || !userId) return
    setCatchUpId(habit.id)
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency, yesterdayDate)
    const yesterdayIso = yesterdayDate.toISOString()

    setHabits(prev => prev.map(h => h.id === habit.id
      ? { ...h, streak_count: newStreak, longest_streak: Math.max(newStreak, h.longest_streak), last_done_at: yesterdayIso }
      : h
    ))
    setYesterdayLogs(prev => [
      ...prev.filter(l => l.habit_id !== habit.id),
      { habit_id: habit.id, log_date: yesterday, status: 'done' },
    ])

    const supabase = createSupabaseBrowserClient()
    const [, logsRes] = await Promise.all([
      habit.is_global ? Promise.resolve({ error: null }) : supabase.from('personality_habits').update({
        streak_count:   newStreak,
        longest_streak: Math.max(newStreak, habit.longest_streak),
        last_done_at:   yesterdayIso,
        updated_at:     new Date().toISOString(),
      }).eq('id', habit.id),
      supabase.from('habit_logs').upsert(
        { user_id: userId, habit_id: habit.id, log_date: yesterday, status: 'done' },
        { onConflict: 'habit_id,user_id,log_date' }
      ),
    ])

    if (!logsRes.error) celebrate()
    setCatchUpId(null)
  }
```

This mirrors the optimistic-update pattern `markDone` already uses for `weekLogs` — updating `yesterdayLogs` locally as soon as the tap happens, so the banner immediately drops the just-caught-up habit instead of waiting on a refetch.

- [ ] **Step 4: Compute the catchable-habits list**

Directly before the `if (loading) return (...)` block, add:

```ts
  const graceOpen = isGraceActive() && !yesterdayLogsOffline
  const catchableHabits = graceOpen
    ? habits.filter(h => h.frequency === 'daily' && !yesterdayLogs.some(l => l.habit_id === h.id && l.status === 'done'))
    : []
```

- [ ] **Step 5: Render the banner**

In the returned JSX, add the banner directly after `{celebrationNode}` (from Task 6) and before the `{/* Edit modal (controlled) */}` comment:

```tsx
      {celebrationNode}

      {/* Grace-period catch-up banner */}
      {catchableHabits.length > 0 && !bannerDismissed && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 overflow-hidden">
          <button
            onClick={() => setBannerExpanded(e => !e)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-sm text-amber-200">
              {catchableHabits.length} habit{catchableHabits.length > 1 ? 's' : ''} missed yesterday — grace ends at 12:00 PM
            </span>
            <span
              onClick={e => { e.stopPropagation(); dismissBanner() }}
              role="button"
              aria-label="Dismiss"
              className="text-amber-400/60 hover:text-amber-300 shrink-0"
            >
              <X className="h-4 w-4" />
            </span>
          </button>
          {bannerExpanded && (
            <div className="border-t border-amber-500/20 px-4 py-3 space-y-2">
              {catchableHabits.map(habit => (
                <div key={habit.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300 truncate">{habit.habit_name}</span>
                  <button
                    onClick={() => markDoneForYesterday(habit)}
                    disabled={catchUpId === habit.id}
                    className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {catchUpId === habit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Mark done
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit modal (controlled) */}
```

- [ ] **Step 6: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 7: Manual walkthrough (no live DB — reasoning check)**

Read through `markDoneForYesterday` and confirm: it upserts `habit_logs` with `log_date = yesterday` (not today), so today's habit stays independently pending; it uses `computeStreak(..., yesterdayDate)` so the streak math treats the completion as happening on the correct earlier day; it skips the `personality_habits` write for global habits, matching `markDone`'s existing behavior.

- [ ] **Step 8: Commit**

```bash
git add src/components/personality/HabitTracker.tsx
git commit -m "feat: add grace-period catch-up banner to HabitTracker"
```

---

### Task 10: Grace catch-up banner in QuickLog.tsx's HabitPanel

**Files:**
- Modify: `src/components/shared/QuickLog.tsx`

**Interfaces:**
- Consumes: `yesterdayStr`, `isGraceActive` from `@/lib/habitStreak` (Task 1).

- [ ] **Step 1: Extend the import**

Change:

```ts
import { computeStreak, todayStr } from '@/lib/habitStreak'
```

to:

```ts
import { computeStreak, todayStr, yesterdayStr, isGraceActive } from '@/lib/habitStreak'
```

- [ ] **Step 2: Add a yesterday-logs query and state inside HabitPanel**

Inside `function HabitPanel() {`, directly after the existing `logs` query (the `useCachedQuery` call fetching today's `habit_logs`), add:

```ts
  const yesterday = yesterdayStr()
  const {
    data: yesterdayLogs, isOffline: yesterdayLogsOffline, refetch: refetchYesterday,
  } = useCachedQuery<{ habit_id: string; status: string }[]>(
    `habit_logs:${yesterday}`,
    (supabase, userId) => supabase.from('habit_logs')
      .select('habit_id, status')
      .eq('user_id', userId)
      .eq('log_date', yesterday),
    [],
    [yesterday]
  )
```

Add alongside the existing `useState` calls in `HabitPanel`:

```ts
  const [catchUpId, setCatchUpId]     = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissedRaw] = useState(false)
```

Add a second `useEffect`, directly after the existing one that resolves `userId`:

```ts
  useEffect(() => {
    try { setBannerDismissedRaw(localStorage.getItem(`habit_grace_dismissed_${today}`) === '1') } catch {}
  }, [today])
```

- [ ] **Step 3: Add the catch-up completion function**

Add directly after `markDone`:

```ts
  function dismissBanner() {
    setBannerDismissedRaw(true)
    try { localStorage.setItem(`habit_grace_dismissed_${today}`, '1') } catch {}
  }

  async function markDoneForYesterday(habit: Habit) {
    if (catchUpId || !userId) return
    setCatchUpId(habit.id)
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency, yesterdayDate)
    const yesterdayIso = yesterdayDate.toISOString()

    setHabits(prev => prev.map(h => h.id === habit.id
      ? { ...h, streak_count: newStreak, longest_streak: Math.max(newStreak, h.longest_streak), last_done_at: yesterdayIso }
      : h
    ))

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.from('habit_logs').upsert(
      { user_id: userId, habit_id: habit.id, log_date: yesterday, status: 'done' },
      { onConflict: 'habit_id,user_id,log_date' }
    )
    await supabase.from('personality_habits').update({
      streak_count:   newStreak,
      longest_streak: Math.max(newStreak, habit.longest_streak),
      last_done_at:   yesterdayIso,
      updated_at:     new Date().toISOString(),
    }).eq('id', habit.id)

    if (!error) celebrate()
    refetchYesterday()
    setCatchUpId(null)
  }
```

(No `is_global` branch needed here — `HabitPanel`'s own habits query already filters to `.eq('user_id', userId)` only, so every habit it ever renders belongs to the current user.)

- [ ] **Step 4: Compute the catchable-habits list**

Directly before the `if (loading) return ...` line in `HabitPanel`, add:

```ts
  const graceOpen = isGraceActive() && !yesterdayLogsOffline
  const catchableHabits = graceOpen
    ? habits.filter(h => h.frequency === 'daily' && !yesterdayLogs.some(l => l.habit_id === h.id && l.status === 'done'))
    : []
```

- [ ] **Step 5: Render the banner**

In `HabitPanel`'s returned JSX, add the banner directly after `{celebrationNode}` (from Task 7):

```tsx
      {celebrationNode}
      {catchableHabits.length > 0 && !bannerDismissed && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-amber-200">
              {catchableHabits.length} missed yesterday — grace ends 12 PM
            </p>
            <button onClick={dismissBanner} aria-label="Dismiss" className="text-amber-400/60 hover:text-amber-300 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {catchableHabits.map(habit => (
            <div key={habit.id} className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-300 truncate">{habit.habit_name}</span>
              <button
                onClick={() => markDoneForYesterday(habit)}
                disabled={catchUpId === habit.id}
                className="shrink-0 flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 px-2 py-1 text-[11px] font-medium text-white transition-colors disabled:opacity-50"
              >
                {catchUpId === habit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Mark done
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-center text-slate-500">
```

(The `<p className="text-xs text-center text-slate-500">` line at the end is the existing "X/Y done today" line already in the file — it stays exactly as-is, this just shows where the new block is inserted relative to it.)

- [ ] **Step 6: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/QuickLog.tsx
git commit -m "feat: add grace-period catch-up banner to QuickLog HabitPanel"
```

---

### Task 11: Full build verification

**Files:** none (verification only).

- [ ] **Step 1: Run the type checker one more time on the whole project**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 2: Run a full production build**

```bash
npm run build
```

Expected: build completes successfully (exit code 0), no type or compile errors.

- [ ] **Step 3: Manual reasoning walkthrough**

Confirm by reading the diff (not live-testable — no linked Supabase session in this environment per `README.md` §3):
- All three mark-done call sites (`HabitTracker.markDone`, `QuickLog.HabitPanel.markDone`, `QuickLog.VoicePanel.confirmLog`'s habit branch) call `celebrate()` only after their Supabase write succeeds (or, for `VoicePanel`, inside the same try block that already throws/catches on failure — so a failed save never shows the celebration).
- Both catch-up functions (`HabitTracker.markDoneForYesterday`, `QuickLog.HabitPanel.markDoneForYesterday`) write `log_date` = yesterday's date, not today's, so a later normal `markDone` call for today's slot is unaffected.
- `isGraceActive()`/`graceDeadlineToday()` use plain `new Date()` (device-local time), matching the explicit design decision — no `notification_settings.timezone` lookup was introduced.
- No new Supabase migration was added — confirm `supabase/migrations/` is unchanged by this work (`git status` should show no new/modified files under that directory from this plan).

- [ ] **Step 4: Push the branch**

```bash
git push
```

Confirm the push targets the current branch (`develop` per this repo's `gitStatus`) and not a force-push — this plan makes no history-rewriting commits, so a normal `git push` is expected to succeed.
