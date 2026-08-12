# Unified Habit + Todo Points Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Supersedes** `docs/superpowers/plans/2026-07-22-habit-reward-system.md`. That plan's architecture and
> point economy are still correct and this plan reuses them verbatim where the underlying code hasn't
> moved (Tasks 2, 3, 6, 11, 12, 13, 14 below are copy-identical to that plan's Tasks 2, 3, 6, 11, 12, 13,
> 14). But its Tasks 1, 4, 5, 7, 8, 9, 10 were written against a July 22 snapshot of the codebase that
> has since gained shared `src/lib/habitStreak.ts` streak logic, a grace-period "yesterday" catch-up
> flow, hidden-global-habit filtering, and a coin-burst celebration hook — none of which that plan's
> code samples account for. This plan's equivalent tasks are rewritten against the current file
> contents. Two tasks are new: yesterday catch-up support (folded into Task 4) and todo points (Task 15).

**Goal:** Make the already-migrated (but otherwise unused) `043_reward_system.sql` schema actually work: habits and todos earn real, persisted, spendable points; per-habit and perfect-day streak milestones pop a celebration; a `/rewards` page lets the user manage a reward catalog and redeem points against it.

**Architecture:** A consolidated `POST /api/habits/complete` endpoint owns every habit-completion side effect (streak update, `habit_logs` write, daily points, per-habit milestone, perfect-day tracking) for both "today" and the grace-period "yesterday" catch-up, so the logic that currently exists at three separate call sites (`HabitTracker.tsx`, `QuickLog.tsx`'s `HabitPanel` and `VoicePanel`) isn't tripled. A `RewardContext` queues milestone celebrations for a global popup, mirroring the existing `TimerContext` pattern. Todo completions are simpler (no milestones to consolidate) and award points via a direct client-side call at their two existing write sites. All new tables already exist in `043_reward_system.sql` (including RLS); this plan only adds the missing atomic-increment RPC function and backfill statement to that same file.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), no test framework in this repo (confirmed: no jest/vitest, no `*.test.*` files) — verification is `npx tsc --noEmit`, a full `next build`, small throwaway Node scripts for pure-logic functions (deleted after use), and manual reasoning, matching every other feature in this codebase.

## Global Constraints

- Migrations in this repo are applied manually via the Supabase Dashboard SQL Editor — nothing here can be executed against a live database from this environment. Every task's verification is static (type-check/build/logic-trace), not a live DB round-trip.
- No new dependencies — everything uses what's already installed (`lucide-react`, existing Supabase clients, `date-fns`, `cn`).
- `'use client'` components use `createSupabaseBrowserClient()` from `@/lib/supabase`; server components/API routes use `createSupabaseServerClient()` from `@/lib/supabase-server`. API routes return `NextResponse.json({ error }, { status })` on failure.
- Point values, milestone thresholds/amounts, and the perfect-day definition are fixed by `docs/superpowers/specs/2026-07-22-habit-reward-system-design.md` — do not invent different numbers. The grace-period "yesterday" extension and todo points are fixed by `docs/superpowers/specs/2026-08-13-habit-points-engine-design.md`.
- `celebrate()` (the coin-burst/chime hook, already wired at every existing habit-completion call site) must keep firing on every successful completion, milestone or not — none of the tasks below may drop it.
- Hidden global habits (`user_hidden_habits`) stay excluded from the perfect-day check, matching every other place they're already excluded.

---

### Task 1: Add the missing RPC function and backfill to the reward-system migration

**Files:**
- Modify: `supabase/migrations/043_reward_system.sql`

**Interfaces:**
- Produces: `increment_points_balance(p_user_id UUID, p_delta INTEGER) RETURNS void`, callable via `supabase.rpc('increment_points_balance', { p_user_id, p_delta })`. Tasks 4, 12, 15 call this.

- [ ] **Step 1: Add the backfill statement and RPC function**

This file already has all four tables with RLS (committed earlier). Add the backfill and the RPC function. After the `ALTER TABLE public.personality_habits ADD COLUMN IF NOT EXISTS last_milestone_awarded ...` line, add:

```sql
-- Backfill: existing habits already have a streak_count built up before
-- this feature existed. Set last_milestone_awarded to the highest
-- threshold already reached so there's no retroactive flood of popups
-- the moment this ships — the *next* new milestone still pays out.
UPDATE public.personality_habits
SET last_milestone_awarded = (
  SELECT COALESCE(MAX(t), 0)
  FROM unnest(ARRAY[7, 14, 30, 60, 90, 180, 365]) AS t
  WHERE t <= streak_count
);
```

At the end of the file, after the last `CREATE POLICY` statement, add:

```sql
-- Atomic balance increment/decrement (used for both awarding and
-- redemption spending) — avoids a read-then-write race between
-- concurrent requests. Runs as SECURITY INVOKER (default), so the
-- caller's own RLS policy above still applies: a mismatched p_user_id
-- simply matches zero rows.
CREATE OR REPLACE FUNCTION public.increment_points_balance(p_user_id UUID, p_delta INTEGER)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.user_rewards
  SET points_balance = points_balance + p_delta, updated_at = NOW()
  WHERE user_id = p_user_id;
$$;
```

- [ ] **Step 2: Sanity-check by reading the file back**

There's no linked Supabase CLI session in this environment — migrations are applied manually by the user via the Supabase Dashboard SQL Editor, so nothing here executes locally. Read the full file back and confirm: 4 `CREATE TABLE` statements, each with a matching `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`, the `last_milestone_awarded` column addition, the new backfill `UPDATE`, and the new `increment_points_balance` function, in that order.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/043_reward_system.sql
git commit -m "feat: add increment_points_balance RPC and milestone backfill to reward migration"
```

---

### Task 2: Milestone constants (pure logic)

**Files:**
- Create: `src/lib/rewardMilestones.ts`

**Interfaces:**
- Produces: `MILESTONE_THRESHOLDS: readonly number[]`, `PER_HABIT_MILESTONE_POINTS: Record<number, number>`, `OVERALL_MILESTONE_POINTS: Record<number, number>`, `DAILY_POINTS: number`, `DAILY_POINTS_KEYSTONE: number`, `highestMilestoneCrossed(streakCount: number): number`. Task 4 imports all of these.

- [ ] **Step 1: Write the file**

```ts
export const MILESTONE_THRESHOLDS = [7, 14, 30, 60, 90, 180, 365] as const

export const PER_HABIT_MILESTONE_POINTS: Record<number, number> = {
  7: 50, 14: 100, 30: 250, 60: 500, 90: 1000, 180: 2000, 365: 5000,
}

export const OVERALL_MILESTONE_POINTS: Record<number, number> = {
  7: 150, 14: 300, 30: 750, 60: 1500, 90: 3000, 180: 6000, 365: 15000,
}

export const DAILY_POINTS          = 5
export const DAILY_POINTS_KEYSTONE = 10

// Returns the highest milestone threshold <= streakCount, or 0 if none reached.
export function highestMilestoneCrossed(streakCount: number): number {
  let highest = 0
  for (const t of MILESTONE_THRESHOLDS) {
    if (streakCount >= t) highest = t
  }
  return highest
}
```

- [ ] **Step 2: Verify with a throwaway script**

```bash
cat > /tmp/verify-milestones.mjs << 'EOF'
const MILESTONE_THRESHOLDS = [7, 14, 30, 60, 90, 180, 365]
function highestMilestoneCrossed(streakCount) {
  let highest = 0
  for (const t of MILESTONE_THRESHOLDS) if (streakCount >= t) highest = t
  return highest
}
const cases = [[0,0],[6,0],[7,7],[13,7],[14,14],[29,14],[30,30],[364,180],[365,365],[1000,365]]
let ok = true
for (const [input, expected] of cases) {
  const got = highestMilestoneCrossed(input)
  if (got !== expected) { console.log(`FAIL streak=${input} expected=${expected} got=${got}`); ok = false }
}
console.log(ok ? 'ALL PASS' : 'FAILURES ABOVE')
EOF
node /tmp/verify-milestones.mjs
rm /tmp/verify-milestones.mjs
```

Expected output: `ALL PASS`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rewardMilestones.ts
git commit -m "feat: add reward milestone threshold/point constants"
```

---

### Task 3: Perfect-day detection (pure logic)

**Files:**
- Create: `src/lib/perfectDay.ts`

**Interfaces:**
- Produces: `isPerfectDay(habits: { id: string; frequency: 'daily' | 'weekly' }[], logsForDay: { habit_id: string; status: 'done' | 'missed' }[]): boolean`. Task 4 imports this.

- [ ] **Step 1: Write the file**

```ts
export interface DailyHabitLike { id: string; frequency: 'daily' | 'weekly' }
export interface HabitLogLike   { habit_id: string; status: 'done' | 'missed' }

// A day counts as "perfect" if every *daily*-frequency habit (weekly
// habits excluded — they don't need daily action) has a log for that
// day, whether 'done' or 'missed' (skipped). Only a habit left with NO
// log at all — i.e. still pending, actionable — blocks "perfect". This
// matches HabitTracker.tsx's own convention of excluding missed habits
// from its "X/Y done today" tally. Pass whichever day's habits/logs you
// want evaluated — the caller decides "today" vs "yesterday".
//
// A user with zero daily habits can never have a "perfect day" — there's
// nothing to be perfect about.
export function isPerfectDay(habits: DailyHabitLike[], logsForDay: HabitLogLike[]): boolean {
  const dailyHabits = habits.filter(h => h.frequency === 'daily')
  if (dailyHabits.length === 0) return false
  const loggedIds = new Set(logsForDay.map(l => l.habit_id))
  return dailyHabits.every(h => loggedIds.has(h.id))
}
```

- [ ] **Step 2: Verify with a throwaway script**

```bash
cat > /tmp/verify-perfect-day.mjs << 'EOF'
function isPerfectDay(habits, logsForDay) {
  const dailyHabits = habits.filter(h => h.frequency === 'daily')
  if (dailyHabits.length === 0) return false
  const loggedIds = new Set(logsForDay.map(l => l.habit_id))
  return dailyHabits.every(h => loggedIds.has(h.id))
}

const cases = [
  { name: 'no habits at all',                  habits: [],                                                                    logs: [],                                             expected: false },
  { name: 'one daily habit, done',             habits: [{ id: 'a', frequency: 'daily' }],                                     logs: [{ habit_id: 'a', status: 'done' }],            expected: true  },
  { name: 'one daily habit, missed (skip)',    habits: [{ id: 'a', frequency: 'daily' }],                                     logs: [{ habit_id: 'a', status: 'missed' }],          expected: true  },
  { name: 'one daily habit, no log (pending)', habits: [{ id: 'a', frequency: 'daily' }],                                     logs: [],                                             expected: false },
  { name: 'weekly habit excluded, no log',     habits: [{ id: 'a', frequency: 'daily' }, { id: 'b', frequency: 'weekly' }],    logs: [{ habit_id: 'a', status: 'done' }],            expected: true  },
  { name: 'two daily, one pending',            habits: [{ id: 'a', frequency: 'daily' }, { id: 'b', frequency: 'daily' }],    logs: [{ habit_id: 'a', status: 'done' }],            expected: false },
]

let ok = true
for (const c of cases) {
  const got = isPerfectDay(c.habits, c.logs)
  if (got !== c.expected) { console.log(`FAIL ${c.name}: expected=${c.expected} got=${got}`); ok = false }
}
console.log(ok ? 'ALL PASS' : 'FAILURES ABOVE')
EOF
node /tmp/verify-perfect-day.mjs
rm /tmp/verify-perfect-day.mjs
```

Expected output: `ALL PASS`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/perfectDay.ts
git commit -m "feat: add perfect-day detection logic"
```

---

### Task 4: Consolidated habit-completion API endpoint (today + yesterday catch-up)

**Files:**
- Create: `src/app/api/habits/complete/route.ts`

**Interfaces:**
- Consumes: `highestMilestoneCrossed`, `PER_HABIT_MILESTONE_POINTS`, `OVERALL_MILESTONE_POINTS`, `DAILY_POINTS`, `DAILY_POINTS_KEYSTONE` from `@/lib/rewardMilestones` (Task 2); `isPerfectDay` from `@/lib/perfectDay` (Task 3); `computeStreak`, `todayStr`, `yesterdayStr` from `@/lib/habitStreak` (already exists, unmodified); `createSupabaseServerClient` from `@/lib/supabase-server`.
- Produces: `POST /api/habits/complete` — body `{ habit_id: string, for?: 'today' | 'yesterday' }` (defaults to `'today'`), response `{ streak_count: number, milestones: { label: string; points: number }[] }` on success, `{ error: string }` with a non-2xx status on failure. Tasks 5, 8, 9, 10 depend on this exact request/response shape.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { computeStreak, todayStr, yesterdayStr } from '@/lib/habitStreak'
import {
  highestMilestoneCrossed, PER_HABIT_MILESTONE_POINTS, OVERALL_MILESTONE_POINTS,
  DAILY_POINTS, DAILY_POINTS_KEYSTONE,
} from '@/lib/rewardMilestones'
import { isPerfectDay } from '@/lib/perfectDay'

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

interface Milestone { label: string; points: number }

async function awardPoints(supabase: SupabaseClient, userId: string, delta: number, reason: string) {
  await supabase.from('reward_points_log').insert({ user_id: userId, delta, reason })
  await supabase.rpc('increment_points_balance', { p_user_id: userId, p_delta: delta })
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { habit_id, for: forDay } = await req.json() as { habit_id?: string; for?: 'today' | 'yesterday' }
  if (!habit_id) return NextResponse.json({ error: 'habit_id required' }, { status: 400 })
  const isYesterday = forDay === 'yesterday'

  const { data: habit, error: habitErr } = await supabase
    .from('personality_habits')
    .select('id, habit_name, streak_count, longest_streak, last_done_at, frequency, is_keystone, is_global, last_milestone_awarded')
    .eq('id', habit_id)
    .single()
  if (habitErr || !habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  // Reference point for every date-sensitive calculation below — "today"
  // in the normal case, "yesterday" for a grace-period catch-up. Mirrors
  // markDoneForYesterday's existing client-side behavior exactly.
  const refDate  = isYesterday ? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d })() : new Date()
  const logDate  = isYesterday ? yesterdayStr() : todayStr()
  const now       = new Date().toISOString()
  const refIso    = isYesterday ? refDate.toISOString() : now
  const milestones: Milestone[] = []

  // Defense-in-depth mirroring markDoneForYesterday's client-side guard:
  // never roll last_done_at backwards. If the habit already has a
  // last_done_at on/after the reference day, this call is stale/replayed.
  if (isYesterday && habit.last_done_at) {
    const lastMidnight = new Date(habit.last_done_at); lastMidnight.setHours(0, 0, 0, 0)
    const refMidnight   = new Date(refDate);            refMidnight.setHours(0, 0, 0, 0)
    if (lastMidnight.getTime() >= refMidnight.getTime()) {
      return NextResponse.json({ error: 'Already up to date' }, { status: 409 })
    }
  }

  // 1. Upsert the log for the target day as done
  await supabase.from('habit_logs').upsert(
    { user_id: user.id, habit_id: habit.id, log_date: logDate, status: 'done' },
    { onConflict: 'habit_id,user_id,log_date' }
  )

  // 2. Update streak — skipped for global habits (shared row across every
  // user, so no per-user streak can live on it; matches existing client behavior).
  let newStreak = habit.streak_count
  if (!habit.is_global) {
    newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency, refDate)
    await supabase.from('personality_habits').update({
      streak_count:   newStreak,
      longest_streak: Math.max(newStreak, habit.longest_streak),
      last_done_at:   refIso,
      updated_at:     now,
    }).eq('id', habit.id)
  }

  // 3. Ensure a user_rewards row exists before awarding anything
  await supabase.from('user_rewards').upsert(
    { user_id: user.id },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )

  // 4. Daily points
  const dailyPoints = habit.is_keystone ? DAILY_POINTS_KEYSTONE : DAILY_POINTS
  await awardPoints(supabase, user.id, dailyPoints, `Daily: ${habit.habit_name}`)

  // 5. Per-habit milestone — skipped for global habits, same reason as step 2
  if (!habit.is_global) {
    const lastAwarded = habit.last_milestone_awarded ?? 0
    // A broken-and-restarted streak (newStreak === 1) resets the ladder.
    const baseline = newStreak === 1 ? 0 : lastAwarded
    const crossed  = highestMilestoneCrossed(newStreak)
    if (crossed > baseline) {
      const points = PER_HABIT_MILESTONE_POINTS[crossed]
      await awardPoints(supabase, user.id, points, `Milestone: ${habit.habit_name} ${crossed}-day streak`)
      await supabase.from('personality_habits').update({ last_milestone_awarded: crossed }).eq('id', habit.id)
      milestones.push({ label: `${habit.habit_name} — ${crossed}-day streak!`, points })
    } else if (baseline !== lastAwarded) {
      await supabase.from('personality_habits').update({ last_milestone_awarded: 0 }).eq('id', habit.id)
    }
  }

  // 6. Perfect-day check for the SAME target day (today or yesterday),
  // including global habits (visible in every user's tracker) but
  // excluding any global habit this user has hidden — matches every
  // other place hidden global habits are excluded.
  const [{ data: dailyHabitsRaw }, { data: logsForDay }, { data: hiddenMarks }, { data: rewards }] = await Promise.all([
    supabase.from('personality_habits').select('id, frequency, is_global')
      .or(`user_id.eq.${user.id},is_global.eq.true`).eq('frequency', 'daily'),
    supabase.from('habit_logs').select('habit_id, status')
      .eq('user_id', user.id).eq('log_date', logDate),
    supabase.from('user_hidden_habits').select('habit_id').eq('user_id', user.id),
    supabase.from('user_rewards').select('current_perfect_streak, longest_perfect_streak, last_perfect_date, last_overall_milestone')
      .eq('user_id', user.id).single(),
  ])

  const hiddenIds   = new Set((hiddenMarks ?? []).map(h => h.habit_id))
  const dailyHabits = (dailyHabitsRaw ?? []).filter(h => !h.is_global || !hiddenIds.has(h.id))

  if (rewards && isPerfectDay(dailyHabits, logsForDay ?? []) && rewards.last_perfect_date !== logDate) {
    const priorDay        = isYesterday ? (() => { const d = new Date(); d.setDate(d.getDate() - 2); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') })() : yesterdayStr()
    const newPerfect       = rewards.last_perfect_date === priorDay ? rewards.current_perfect_streak + 1 : 1
    const longestPerfect   = Math.max(newPerfect, rewards.longest_perfect_streak)
    const overallBaseline  = newPerfect === 1 ? 0 : rewards.last_overall_milestone
    const overallCrossed   = highestMilestoneCrossed(newPerfect)

    await supabase.from('user_rewards').update({
      current_perfect_streak: newPerfect,
      longest_perfect_streak: longestPerfect,
      last_perfect_date:      logDate,
      last_overall_milestone: overallCrossed > overallBaseline ? overallCrossed : overallBaseline,
      updated_at:              now,
    }).eq('user_id', user.id)

    if (overallCrossed > overallBaseline) {
      const points = OVERALL_MILESTONE_POINTS[overallCrossed]
      await awardPoints(supabase, user.id, points, `Milestone: Perfect day streak ${overallCrossed} days`)
      milestones.push({ label: `Perfect Day Streak — ${overallCrossed} days!`, points })
    }
  }

  return NextResponse.json({ streak_count: newStreak, milestones })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output. Confirms the route compiles against `@/lib/rewardMilestones`, `@/lib/perfectDay`, `@/lib/habitStreak`, and `@/lib/supabase-server`'s actual exported signatures — it cannot confirm live database behavior (no linked Supabase project in this environment; requires Task 1's migration to actually be applied).

- [ ] **Step 3: Manual walkthrough (no live DB available — reasoning check, not an execution)**

Read through the route against `docs/superpowers/specs/2026-07-22-habit-reward-system-design.md` and `docs/superpowers/specs/2026-08-13-habit-points-engine-design.md`, and confirm by inspection:
- A global habit never gets a `personality_habits` write for streak or milestone, but still earns daily points and still counts toward the perfect-day check (unless this user has hidden it).
- A broken-and-rebuilt streak (`newStreak === 1`) resets `last_milestone_awarded` to 0 before checking crossing.
- Calling this endpoint twice for an already-perfect day is a no-op for the overall streak (guarded by `rewards.last_perfect_date !== logDate`).
- The `for: 'yesterday'` path upserts/streaks/checks-perfect-day against yesterday's date throughout, not today's, and the defense-in-depth guard rejects a stale/replayed catch-up the same way the client-side guard in `markDoneForYesterday` already does.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/habits/complete/route.ts"
git commit -m "feat: add consolidated habit-completion API endpoint with yesterday catch-up"
```

---

### Task 5: Client helper for calling the completion endpoint

**Files:**
- Create: `src/lib/completeHabit.ts`

**Interfaces:**
- Produces: `interface RewardMilestone { label: string; points: number }`, `completeHabit(habitId: string, forDay?: 'today' | 'yesterday'): Promise<{ streak_count: number; milestones: RewardMilestone[] }>`. Tasks 8, 9, 10 import from this file.

- [ ] **Step 1: Write the file**

```ts
export interface RewardMilestone { label: string; points: number }

export async function completeHabit(
  habitId: string,
  forDay: 'today' | 'yesterday' = 'today'
): Promise<{ streak_count: number; milestones: RewardMilestone[] }> {
  const res = await fetch('/api/habits/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habit_id: habitId, for: forDay }),
  })
  if (!res.ok) throw new Error('Failed to complete habit')
  return res.json()
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/completeHabit.ts
git commit -m "feat: add completeHabit client helper"
```

---

### Task 6: Reward context + milestone celebration popup

**Files:**
- Create: `src/contexts/RewardContext.tsx`
- Create: `src/components/shared/RewardMilestoneModal.tsx`

**Interfaces:**
- Consumes: `RewardMilestone` type from `@/lib/completeHabit` (Task 5).
- Produces: `useReward()` hook returning `{ celebrateMilestones: (milestones: RewardMilestone[]) => void }`; `RewardProvider` component; `RewardMilestoneModal` default-export component. Task 7 wires both into the layout; Tasks 8, 9, 10 call `useReward().celebrateMilestones(...)`.

- [ ] **Step 1: Write the context**

```tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type { RewardMilestone } from '@/lib/completeHabit'

interface RewardCtx {
  queue: RewardMilestone[]
  celebrateMilestones: (milestones: RewardMilestone[]) => void
  dismissCurrent: () => void
}

const RewardContext = createContext<RewardCtx | null>(null)

export function useReward() {
  const ctx = useContext(RewardContext)
  if (!ctx) throw new Error('useReward must be used within RewardProvider')
  return ctx
}

export function RewardProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<RewardMilestone[]>([])

  function celebrateMilestones(milestones: RewardMilestone[]) {
    if (milestones.length === 0) return
    setQueue(prev => [...prev, ...milestones])
  }

  function dismissCurrent() {
    setQueue(prev => prev.slice(1))
  }

  return (
    <RewardContext.Provider value={{ queue, celebrateMilestones, dismissCurrent }}>
      {children}
    </RewardContext.Provider>
  )
}
```

- [ ] **Step 2: Write the popup component**

```tsx
'use client'

import { Sparkles, X } from 'lucide-react'
import { useReward } from '@/contexts/RewardContext'

export default function RewardMilestoneModal() {
  const { queue, dismissCurrent } = useReward()
  const current = queue[0]
  if (!current) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-center space-y-4 shadow-2xl">
        <button onClick={dismissCurrent} className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 border-2 border-amber-500/40 mx-auto">
          <Sparkles className="h-8 w-8 text-amber-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">🎉 {current.label}</p>
          <p className="text-amber-400 font-semibold mt-1">+{current.points} points</p>
        </div>
        <button
          onClick={dismissCurrent}
          className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-3 text-sm font-semibold text-white transition-all"
        >
          Nice!
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/RewardContext.tsx src/components/shared/RewardMilestoneModal.tsx
git commit -m "feat: add reward context and milestone celebration popup"
```

---

### Task 7: Wire the reward provider and popup into the app layout

**Files:**
- Modify: `src/app/(main)/layout.tsx`

**Interfaces:**
- Consumes: `RewardProvider` from `@/contexts/RewardContext`, `RewardMilestoneModal` from `@/components/shared/RewardMilestoneModal` (both from Task 6).

- [ ] **Step 1: Add imports**

Add, alongside the existing `TimerProvider`/`FloatingTimer` imports in `src/app/(main)/layout.tsx`:

```ts
import { RewardProvider } from '@/contexts/RewardContext'
import RewardMilestoneModal from '@/components/shared/RewardMilestoneModal'
```

- [ ] **Step 2: Wrap the tree and render the modal**

Replace:

```tsx
  return (
    <TimerProvider>
    <div className="min-h-screen text-white">
```

with:

```tsx
  return (
    <TimerProvider>
    <RewardProvider>
    <div className="min-h-screen text-white">
```

Replace the closing tags at the end of the returned JSX:

```tsx
    </div>
    </TimerProvider>
  )
}
```

with:

```tsx
    </div>
    </RewardProvider>
    </TimerProvider>
  )
}
```

Then add `<RewardMilestoneModal />` next to the other globally-rendered components:

```tsx
      <QuickLog />
      <QuickReset floatingOnly />
      <RewardMilestoneModal />
      <OpeningBriefingModal />
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(main)/layout.tsx"
git commit -m "feat: wire reward provider and milestone popup into main layout"
```

---

### Task 8: Migrate HabitTracker.tsx to the consolidated completion endpoint

**Files:**
- Modify: `src/components/personality/HabitTracker.tsx`

**Interfaces:**
- Consumes: `completeHabit` from `@/lib/completeHabit` (Task 5), `useReward` from `@/contexts/RewardContext` (Task 6).

- [ ] **Step 1: Add imports and call the hook**

Add, alongside the existing imports:

```ts
import { completeHabit } from '@/lib/completeHabit'
import { useReward } from '@/contexts/RewardContext'
```

Inside `export default function HabitTracker() {`, add alongside the existing `useState` calls:

```ts
  const { celebrateMilestones } = useReward()
```

- [ ] **Step 2: Replace markDone**

Read the current file first — this task's diffs assume the exact shape confirmed by prior investigation (lines ~524-561), but re-verify against the file you actually have open before editing, since other tasks in this plan don't touch this file and it could have drifted.

Replace:

```ts
  async function markDone(habit: Habit) {
    if (getStatus(habit.id) !== 'pending' || markingId || !userId) return
    setMarkingId(habit.id)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)
    const now = new Date().toISOString()
    const today = todayStr()

    const supabase = createSupabaseBrowserClient()
    const logPromise = supabase.from('habit_logs').upsert(
      { user_id: userId, habit_id: habit.id, log_date: today, status: 'done' },
      { onConflict: 'habit_id,user_id,log_date' }
    )
    const [, logsRes] = await Promise.all([
      habit.is_global ? Promise.resolve({ error: null }) : supabase.from('personality_habits').update({
        streak_count:   newStreak,
        longest_streak: Math.max(newStreak, habit.longest_streak),
        last_done_at:   now,
        updated_at:     now,
      }).eq('id', habit.id),
      logPromise,
    ])

    // If habit_logs table missing, mark as unavailable so fallback kicks in
    if (logsRes.error) setLogsUnavail(true)
    else celebrate()
    setMarkingId(null)
  }
```

with:

```ts
  async function markDone(habit: Habit) {
    if (getStatus(habit.id) !== 'pending' || markingId || !userId) return
    setMarkingId(habit.id)

    try {
      const { streak_count, milestones } = await completeHabit(habit.id)
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: new Date().toISOString() }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      setLogsUnavail(true)
    }
    setMarkingId(null)
  }
```

If the file you have open differs from the "before" block above (e.g. it already has an optimistic `setHabits`/`setWeekLogs` update before the writes, or a slightly different variable name), preserve that surrounding logic and only replace the actual write calls (the `createSupabaseBrowserClient()` upsert/update pair) with the `completeHabit()` call plus the state update shown above — the important invariants are: no direct `habit_logs`/`personality_habits` writes remain in this function, `celebrate()` still fires on success, and `celebrateMilestones(milestones)` is called with the endpoint's response.

- [ ] **Step 3: Replace markDoneForYesterday's write block**

This function opens with a defense-in-depth guard (computing `yesterdayMidnight`, comparing it against `habit.last_done_at`, and returning early if the habit is already caught up — same shape as the guard already quoted in full in Task 9's Step 3 for the `QuickLog.tsx` version of this function). **Leave that entire guard block untouched.** Only the part of the function from `setCatchUpId(habit.id)` onward changes.

Replace:

```ts
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

with:

```ts
    setCatchUpId(habit.id)

    try {
      const { streak_count, milestones } = await completeHabit(habit.id, 'yesterday')
      const yesterdayIso = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString() })()
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: yesterdayIso }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      // no local state to roll back — nothing was optimistically set before the call
    }
    refetchYesterday()
    setCatchUpId(null)
  }
```

If the exact current file's write block differs from the "before" shown here (variable naming, whether `yesterday`/`yesterdayIso` are computed once earlier in the function, etc.), the invariant that matters is the same as Step 2: no direct `habit_logs`/`personality_habits` writes remain, `celebrate()` still fires on success, `celebrateMilestones(milestones)` is called with the endpoint's response, and `refetchYesterday()`/`setCatchUpId(null)` still run at the end exactly as they do today.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output. If a local `computeStreak`/`todayStr` import becomes unused as a result of this change, leave it — `habitStreak.ts`'s exports are used elsewhere in this same file (e.g. by other habit-status logic), so don't remove the import line itself, only the calls you actually replaced.

- [ ] **Step 5: Commit**

```bash
git add src/components/personality/HabitTracker.tsx
git commit -m "refactor: HabitTracker habit completion uses the consolidated endpoint"
```

---

### Task 9: Migrate QuickLog.tsx's HabitPanel to the consolidated endpoint

**Files:**
- Modify: `src/components/shared/QuickLog.tsx`

**Interfaces:**
- Consumes: `completeHabit` from `@/lib/completeHabit` (Task 5), `useReward` from `@/contexts/RewardContext` (Task 6).

- [ ] **Step 1: Add imports and call the hook**

Add, alongside the existing imports near the top of the file:

```ts
import { completeHabit } from '@/lib/completeHabit'
import { useReward } from '@/contexts/RewardContext'
```

Inside `function HabitPanel() {`, add alongside its existing `useState` calls:

```ts
  const { celebrateMilestones } = useReward()
```

- [ ] **Step 2: Replace markDone**

Replace:

```ts
  async function markDone(habit: Habit) {
    if (doneIds.has(habit.id) || !!markingId || !userId) return
    setMarkingId(habit.id)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)
    const now   = new Date().toISOString()
    const today = todayStr()

    setDoneIds(prev => { const s = new Set(prev); s.add(habit.id); return s })
    setHabits(prev => prev.map(h => h.id === habit.id
      ? { ...h, streak_count: newStreak, longest_streak: Math.max(newStreak, h.longest_streak), last_done_at: now }
      : h
    ))

    const supabase = createSupabaseBrowserClient()
    await Promise.all([
      supabase.from('personality_habits').update({
        streak_count:   newStreak,
        longest_streak: Math.max(newStreak, habit.longest_streak),
        last_done_at:   now,
        updated_at:     now,
      }).eq('id', habit.id),
      supabase.from('habit_logs').upsert(
        { user_id: userId, habit_id: habit.id, log_date: today, status: 'done' },
        { onConflict: 'habit_id,user_id,log_date' }
      ),
    ])
    celebrate()
    setMarkingId(null)
  }
```

with:

```ts
  async function markDone(habit: Habit) {
    if (doneIds.has(habit.id) || !!markingId || !userId) return
    setMarkingId(habit.id)

    setDoneIds(prev => { const s = new Set(prev); s.add(habit.id); return s })

    try {
      const { streak_count, milestones } = await completeHabit(habit.id)
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: new Date().toISOString() }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      setDoneIds(prev => { const s = new Set(prev); s.delete(habit.id); return s })
    }
    setMarkingId(null)
  }
```

- [ ] **Step 3: Replace markDoneForYesterday**

Replace this function's body (keep the defense-in-depth guard at the top exactly as-is):

```ts
  async function markDoneForYesterday(habit: Habit) {
    if (catchUpId || !userId) return

    // Defense-in-depth: ... (guard block — leave unchanged)

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

with:

```ts
  async function markDoneForYesterday(habit: Habit) {
    if (catchUpId || !userId) return

    // Defense-in-depth: ... (guard block — leave unchanged)

    setCatchUpId(habit.id)

    try {
      const { streak_count, milestones } = await completeHabit(habit.id, 'yesterday')
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString() })() }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      // no local state to roll back — nothing was optimistically set before the call
    }
    refetchYesterday()
    setCatchUpId(null)
  }
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output. `computeStreak` (imported from `@/lib/habitStreak`) is still used elsewhere in this file (e.g. `VoicePanel`, migrated in Task 10, and possibly other status-derivation logic) — do not remove the import.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/QuickLog.tsx
git commit -m "refactor: QuickLog HabitPanel habit completion uses the consolidated endpoint"
```

---

### Task 10: Migrate QuickLog.tsx's VoicePanel to the consolidated endpoint

**Files:**
- Modify: `src/components/shared/QuickLog.tsx`

**Interfaces:**
- Consumes: `completeHabit` from `@/lib/completeHabit`, `useReward` from `@/contexts/RewardContext` (both already imported in Task 9 — same file).

- [ ] **Step 1: Call the hook inside VoicePanel**

Inside `function VoicePanel({ onDone }: { onDone: () => void }) {`, add alongside its existing `useState` calls:

```ts
  const { celebrateMilestones } = useReward()
```

- [ ] **Step 2: Replace the habit branch inside confirmLog**

Inside `async function confirmLog() {`, replace only this branch:

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
            { onConflict: 'habit_id,user_id,log_date' }
          ),
        ])
        celebrate()
      } else if (result.type === 'journal') {
```

with:

```ts
      } else if (result.type === 'habit' && matchedHabit) {
        const { milestones } = await completeHabit(matchedHabit.id)
        celebrate()
        celebrateMilestones(milestones)
      } else if (result.type === 'journal') {
```

Leave every other branch (`transaction`, `workout`, `meal`, `journal`) exactly as-is — only the `habit` branch changes. Note this replacement keeps `celebrate()`, which the older reference version of this task (from the superseded plan) dropped — do not drop it here.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/QuickLog.tsx
git commit -m "refactor: QuickLog VoicePanel uses the consolidated completion endpoint"
```

---

### Task 11: Reward catalog API (create / edit / delete)

**Files:**
- Create: `src/app/api/rewards/catalog/route.ts`

**Interfaces:**
- Produces: `POST /api/rewards/catalog` (body `{ title, point_cost }` → `{ reward }`), `PATCH /api/rewards/catalog?id=<uuid>` (body `{ title, point_cost }` → `{ reward }`), `DELETE /api/rewards/catalog?id=<uuid>` (→ `{ ok: true }`). Task 13's `RewardsClient.tsx` calls all three.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null, user: null }
  return { error: null, status: 200, supabase, user }
}

export async function POST(req: Request) {
  const { error, status, supabase, user } = await requireUser()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  const { title, point_cost } = await req.json()
  if (!title?.trim() || !point_cost || point_cost <= 0) {
    return NextResponse.json({ error: 'title and a positive point_cost are required' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase.from('reward_catalog').insert({
    user_id:    user.id,
    title:      title.trim(),
    point_cost: Math.round(point_cost),
  }).select().single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}

export async function PATCH(req: Request) {
  const { error, status, supabase, user } = await requireUser()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { title, point_cost } = await req.json()
  if (!title?.trim() || !point_cost || point_cost <= 0) {
    return NextResponse.json({ error: 'title and a positive point_cost are required' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('reward_catalog')
    .update({ title: title.trim(), point_cost: Math.round(point_cost) })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}

export async function DELETE(req: Request) {
  const { error, status, supabase, user } = await requireUser()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error: dbErr } = await supabase
    .from('reward_catalog')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/rewards/catalog/route.ts
git commit -m "feat: add reward catalog CRUD API"
```

---

### Task 12: Redemption API

**Files:**
- Create: `src/app/api/rewards/redeem/route.ts`

**Interfaces:**
- Consumes: the `increment_points_balance` Postgres function (Task 1).
- Produces: `POST /api/rewards/redeem` (body `{ catalog_id }` → `{ redemption }` on success, `{ error }` on failure). Task 13's `RewardsClient.tsx` calls this.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { catalog_id } = await req.json()
  if (!catalog_id) return NextResponse.json({ error: 'catalog_id required' }, { status: 400 })

  const { data: item, error: itemErr } = await supabase
    .from('reward_catalog')
    .select('id, title, point_cost')
    .eq('id', catalog_id)
    .eq('user_id', user.id)
    .single()
  if (itemErr || !item) return NextResponse.json({ error: 'Reward not found' }, { status: 404 })

  const { data: rewards } = await supabase
    .from('user_rewards')
    .select('points_balance')
    .eq('user_id', user.id)
    .single()
  if (!rewards || rewards.points_balance < item.point_cost) {
    return NextResponse.json({ error: 'Not enough points' }, { status: 400 })
  }

  const { error: deductErr } = await supabase.rpc('increment_points_balance', {
    p_user_id: user.id,
    p_delta:   -item.point_cost,
  })
  if (deductErr) return NextResponse.json({ error: deductErr.message }, { status: 500 })

  await supabase.from('reward_points_log').insert({
    user_id: user.id, delta: -item.point_cost, reason: `Redeemed: ${item.title}`,
  })
  const { data: redemption } = await supabase.from('reward_redemptions').insert({
    user_id: user.id, title: item.title, point_cost: item.point_cost,
  }).select().single()

  return NextResponse.json({ redemption })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/rewards/redeem/route.ts
git commit -m "feat: add reward redemption API"
```

---

### Task 13: Rewards page (server page + client UI)

**Files:**
- Create: `src/app/(main)/rewards/page.tsx`
- Create: `src/app/(main)/rewards/RewardsClient.tsx`

**Interfaces:**
- Consumes: `/api/rewards/catalog` (Task 11), `/api/rewards/redeem` (Task 12).
- Produces: the `/rewards` route. Task 14 links to it from navigation.

- [ ] **Step 1: Write the server page**

```tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import RewardsClient from './RewardsClient'

export default async function RewardsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rewards }, { data: catalog }, { data: redemptions }, { data: habits }] = await Promise.all([
    supabase.from('user_rewards')
      .select('points_balance, current_perfect_streak, longest_perfect_streak')
      .eq('user_id', user.id).maybeSingle(),
    supabase.from('reward_catalog')
      .select('id, title, point_cost, created_at')
      .eq('user_id', user.id).order('point_cost', { ascending: true }),
    supabase.from('reward_redemptions')
      .select('id, title, point_cost, redeemed_at')
      .eq('user_id', user.id).order('redeemed_at', { ascending: false }).limit(20),
    supabase.from('personality_habits')
      .select('id, habit_name, streak_count, is_global')
      .or(`user_id.eq.${user.id},is_global.eq.true`)
      .gt('streak_count', 0)
      .order('streak_count', { ascending: false }),
  ])

  return (
    <RewardsClient
      pointsBalance={rewards?.points_balance ?? 0}
      currentPerfectStreak={rewards?.current_perfect_streak ?? 0}
      longestPerfectStreak={rewards?.longest_perfect_streak ?? 0}
      catalog={catalog ?? []}
      redemptions={redemptions ?? []}
      streaks={(habits ?? []).filter(h => !h.is_global)}
    />
  )
}
```

- [ ] **Step 2: Write the client component**

```tsx
'use client'

import { useState } from 'react'
import { Coins, Flame, Plus, Trash2, Pencil, Gift, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CatalogItem { id: string; title: string; point_cost: number; created_at: string }
interface Redemption  { id: string; title: string; point_cost: number; redeemed_at: string }
interface HabitStreak { id: string; habit_name: string; streak_count: number }

const STARTER_CATALOG = [
  { title: '☕ Treat yourself to a coffee', point_cost: 100 },
  { title: '🍽️ Dinner out',                point_cost: 300 },
  { title: '🎬 Movie night',                point_cost: 500 },
  { title: '🏖️ Small day trip',             point_cost: 2500 },
  { title: '✈️ Weekend getaway',            point_cost: 5000 },
]

export default function RewardsClient({
  pointsBalance, currentPerfectStreak, longestPerfectStreak,
  catalog: initialCatalog, redemptions: initialRedemptions, streaks,
}: {
  pointsBalance: number
  currentPerfectStreak: number
  longestPerfectStreak: number
  catalog: CatalogItem[]
  redemptions: Redemption[]
  streaks: HabitStreak[]
}) {
  const [balance, setBalance]         = useState(pointsBalance)
  const [catalog, setCatalog]         = useState(initialCatalog)
  const [redemptions, setRedemptions] = useState(initialRedemptions)
  const [seeding, setSeeding]         = useState(false)
  const [seeded, setSeeded]           = useState(catalog.length > 0)

  const [newTitle, setNewTitle] = useState('')
  const [newCost, setNewCost]   = useState('')
  const [adding, setAdding]     = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCost, setEditCost]   = useState('')

  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  async function seedStarters() {
    setSeeding(true)
    const created: CatalogItem[] = []
    for (const item of STARTER_CATALOG) {
      const res  = await fetch('/api/rewards/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      const data = await res.json()
      if (data.reward) created.push(data.reward)
    }
    setCatalog(created)
    setSeeded(true)
    setSeeding(false)
  }

  async function addReward() {
    const cost = Number(newCost)
    if (!newTitle.trim() || !cost || cost <= 0) return
    setAdding(true)
    setError(null)
    const res  = await fetch('/api/rewards/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), point_cost: cost }),
    })
    const data = await res.json()
    if (data.reward) {
      setCatalog(prev => [...prev, data.reward].sort((a, b) => a.point_cost - b.point_cost))
      setNewTitle(''); setNewCost('')
    } else {
      setError(data.error ?? 'Failed to add reward')
    }
    setAdding(false)
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id); setEditTitle(item.title); setEditCost(String(item.point_cost))
  }

  async function saveEdit(id: string) {
    const cost = Number(editCost)
    if (!editTitle.trim() || !cost || cost <= 0) return
    const res  = await fetch(`/api/rewards/catalog?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim(), point_cost: cost }),
    })
    const data = await res.json()
    if (data.reward) {
      setCatalog(prev => prev.map(c => c.id === id ? data.reward : c).sort((a, b) => a.point_cost - b.point_cost))
      setEditingId(null)
    } else {
      setError(data.error ?? 'Failed to save changes')
    }
  }

  async function deleteReward(id: string) {
    setDeletingId(id)
    await fetch(`/api/rewards/catalog?id=${id}`, { method: 'DELETE' })
    setCatalog(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  async function redeem(item: CatalogItem) {
    if (balance < item.point_cost || redeemingId) return
    setRedeemingId(item.id)
    setError(null)
    const res  = await fetch('/api/rewards/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog_id: item.id }),
    })
    const data = await res.json()
    if (data.redemption) {
      setBalance(prev => prev - item.point_cost)
      setRedemptions(prev => [data.redemption, ...prev])
    } else {
      setError(data.error ?? 'Failed to redeem')
    }
    setRedeemingId(null)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Rewards</h1>
        <p className="text-slate-400 text-sm mt-1">Turn consistent habits into real-world celebrations</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Coins className="h-4 w-4" />
            <p className="text-xs font-medium">Points Balance</p>
          </div>
          <p className="text-3xl font-bold text-white mt-1">{balance}</p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2 text-orange-400">
            <Flame className="h-4 w-4" />
            <p className="text-xs font-medium">Perfect Day Streak</p>
          </div>
          <p className="text-3xl font-bold text-white mt-1">{currentPerfectStreak}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Best: {longestPerfectStreak}</p>
        </div>
      </div>

      {streaks.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Streaks</p>
          <div className="space-y-1.5">
            {streaks.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{h.habit_name}</span>
                <span className="flex items-center gap-1 text-orange-400 font-semibold">
                  <Flame className="h-3.5 w-3.5" /> {h.streak_count}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reward Catalog</p>
          {catalog.length === 0 && !seeded && (
            <button onClick={seedStarters} disabled={seeding} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add starter rewards'}
            </button>
          )}
        </div>

        {catalog.length === 0 && seeded && (
          <p className="text-sm text-slate-500 text-center py-4">No rewards yet — add your first one below.</p>
        )}

        <div className="space-y-2">
          {catalog.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
              {editingId === item.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm text-white" />
                  <input type="number" value={editCost} onChange={e => setEditCost(e.target.value)}
                    className="w-20 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm text-white" />
                  <button onClick={() => saveEdit(item.id)} className="text-xs text-emerald-400">Save</button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm text-white">{item.title}</p>
                    <p className="text-[11px] text-slate-500">{item.point_cost} pts</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => startEdit(item)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteReward(item.id)} disabled={deletingId === item.id} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => redeem(item)}
                      disabled={balance < item.point_cost || redeemingId === item.id}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                        balance >= item.point_cost ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-white/5 text-slate-600'
                      )}
                    >
                      {redeemingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
                      Redeem
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input placeholder="New reward…" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600" />
          <input placeholder="Cost" type="number" value={newCost} onChange={e => setNewCost(e.target.value)}
            className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600" />
          <button onClick={addReward} disabled={adding} className="p-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {redemptions.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Redemption History</p>
          <div className="space-y-1.5">
            {redemptions.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{r.title}</span>
                <span className="text-slate-500">-{r.point_cost} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(main)/rewards/page.tsx" "src/app/(main)/rewards/RewardsClient.tsx"
git commit -m "feat: add /rewards page with catalog, redemption, and streak view"
```

---

### Task 14: Nav wiring

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/MobileDrawer.tsx`

**Interfaces:**
- No new exports — closes out the habits/todos side of this feature. `/rewards` becomes reachable.

- [ ] **Step 1: Sidebar.tsx**

Replace the icon import:

```ts
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, Search,
} from 'lucide-react'
```

with:

```ts
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, Search, Gift,
} from 'lucide-react'
```

Replace `NAV_ITEMS`:

```ts
const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/personality/habits',  label: 'Habits',     icon: Brain },
  { href: '/fitness',             label: 'Fitness',    icon: Dumbbell },
  { href: '/finance',             label: 'Finance',    icon: Wallet },
  { href: '/books',               label: 'Books',      icon: BookOpen },
  { href: '/goals',               label: 'Goals',      icon: Target },
  { href: '/todos',               label: 'Tasks',      icon: CheckSquare },
  { href: '/focus',               label: 'Focus',      icon: Timer },
  { href: '/digest',              label: 'Digest',     icon: Newspaper },
  { href: '/retro',               label: 'Retro',      icon: CalendarCheck },
  { href: '/challenges',          label: 'Challenges', icon: Flame },
  { href: '/personality/journal', label: 'Journal',    icon: NotebookPen },
  { href: '/gallery',             label: 'Gallery',    icon: Images },
]
```

with:

```ts
const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/personality/habits',  label: 'Habits',     icon: Brain },
  { href: '/fitness',             label: 'Fitness',    icon: Dumbbell },
  { href: '/finance',             label: 'Finance',    icon: Wallet },
  { href: '/books',               label: 'Books',      icon: BookOpen },
  { href: '/goals',               label: 'Goals',      icon: Target },
  { href: '/todos',               label: 'Tasks',      icon: CheckSquare },
  { href: '/rewards',             label: 'Rewards',    icon: Gift },
  { href: '/focus',               label: 'Focus',      icon: Timer },
  { href: '/digest',              label: 'Digest',     icon: Newspaper },
  { href: '/retro',               label: 'Retro',      icon: CalendarCheck },
  { href: '/challenges',          label: 'Challenges', icon: Flame },
  { href: '/personality/journal', label: 'Journal',    icon: NotebookPen },
  { href: '/gallery',             label: 'Gallery',    icon: Images },
]
```

- [ ] **Step 2: MobileDrawer.tsx**

Replace the icon import:

```ts
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, X,
} from 'lucide-react'
```

with:

```ts
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, X, Gift,
} from 'lucide-react'
```

Replace `NAV_ITEMS` with the exact same before/after shown in Step 1 (this file has an independent, currently-identical copy of the array — pre-existing duplication between the two files, not something to refactor as part of this task).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/MobileDrawer.tsx
git commit -m "feat: add Rewards link to sidebar and mobile drawer navigation"
```

---

### Task 15: Todo points — unify todo completions into the same ledger

**Files:**
- Modify: `src/components/todos/TaskRewards.tsx`
- Modify: `src/components/todos/TodoList.tsx`
- Modify: `src/components/todos/TodoWidget.tsx`

**Interfaces:**
- Consumes: `increment_points_balance` RPC (Task 1).
- Produces: `taskPoints` becomes an exported function from `TaskRewards.tsx` (currently module-private). No other new exports — this closes out the todo side of the points engine.

- [ ] **Step 1: Export taskPoints from TaskRewards.tsx**

Replace:

```ts
// Points for a single completed todo
function taskPoints(todo: Todo): number {
```

with:

```ts
// Points for a single completed todo
export function taskPoints(todo: Todo): number {
```

Also export the `Todo` interface it depends on (`interface Todo { id: string; is_completed: boolean; completed_at: string | null; due_date: string | null }`) the same way — replace `interface Todo {` with `export interface Todo {`.

- [ ] **Step 2: Award points in TodoList.tsx's handleComplete**

Add the import, alongside the existing `TaskRewards` import:

```ts
import TaskRewards, { taskPoints } from './TaskRewards'
```

Replace:

```ts
  async function handleComplete(id: string) {
    const now = new Date().toISOString()
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, is_completed: true, completed_at: now } : t
    ))
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('user_todos')
      .update({ is_completed: true, completed_at: now, updated_at: now })
      .eq('id', id)
  }
```

with:

```ts
  async function handleComplete(id: string) {
    const now  = new Date().toISOString()
    const todo = todos.find(t => t.id === id)
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, is_completed: true, completed_at: now } : t
    ))
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('user_todos')
      .update({ is_completed: true, completed_at: now, updated_at: now })
      .eq('id', id)

    const { data: { user } } = await supabase.auth.getUser()
    if (user && todo) {
      const points = taskPoints({ ...todo, completed_at: now })
      await supabase.from('user_rewards').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
      await supabase.from('reward_points_log').insert({ user_id: user.id, delta: points, reason: `Task: ${todo.title}` })
      await supabase.rpc('increment_points_balance', { p_user_id: user.id, p_delta: points })
    }
  }
```

- [ ] **Step 3: Award points in TodoWidget.tsx's handleComplete**

Add the import:

```ts
import { taskPoints } from './TaskRewards'
```

Replace:

```ts
  async function handleComplete(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
    const now = new Date().toISOString()
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('user_todos')
      .update({ is_completed: true, completed_at: now, updated_at: now })
      .eq('id', id)
  }
```

with:

```ts
  async function handleComplete(id: string) {
    const todo = todos.find(t => t.id === id)
    setTodos(prev => prev.filter(t => t.id !== id))
    const now = new Date().toISOString()
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('user_todos')
      .update({ is_completed: true, completed_at: now, updated_at: now })
      .eq('id', id)

    const { data: { user } } = await supabase.auth.getUser()
    if (user && todo) {
      const points = taskPoints({ id: todo.id, is_completed: true, completed_at: now, due_date: todo.due_date })
      await supabase.from('user_rewards').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
      await supabase.from('reward_points_log').insert({ user_id: user.id, delta: points, reason: 'Task completed' })
      await supabase.rpc('increment_points_balance', { p_user_id: user.id, p_delta: points })
    }
  }
```

`TodoWidget.tsx`'s local `Todo` interface (`id, title, notes, due_date, is_completed`) does carry `title` — feel free to use `` `Task: ${todo.title}` `` for the reason string instead of the generic `'Task completed'` shown above, for consistency with Step 2's reason format. Either is fine; the exact wording isn't load-bearing.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Manual reasoning check**

Confirm `taskPoints()`'s existing on-time-bonus logic (10 base + 5 if `completed_at` slice matches on/before `due_date`) is being fed the exact same `due_date`/`completed_at` pair in the new award call as `TaskRewards.tsx` uses for its own live display — the two numbers must never be able to drift apart. `TaskRewards.tsx` itself is not modified beyond the `export` keyword additions in Step 1 — its tier tables, streak calc, and weekly grid are untouched.

- [ ] **Step 6: Commit**

```bash
git add src/components/todos/TaskRewards.tsx src/components/todos/TodoList.tsx src/components/todos/TodoWidget.tsx
git commit -m "feat: award points for todo completions into the shared rewards ledger"
```

---

### Task 16: Final build and manual verification checklist

**Files:** none (verification only).

- [ ] **Step 1: Full production build**

```bash
rm -rf .next && npm run build
```

Expected: build completes with no errors, and the route list includes `/rewards` and `/api/habits/complete`.

- [ ] **Step 2: Confirm no stray leftover direct writes**

```bash
grep -n "personality_habits').update" src/components/personality/HabitTracker.tsx src/components/shared/QuickLog.tsx
```

Expected: no matches from `markDone`/`markDoneForYesterday`/the VoicePanel habit branch (any remaining matches should belong to unrelated functions like `undoLog`, which this plan does not touch).

- [ ] **Step 3: Manual walkthrough checklist for the user**

Cannot be executed from this environment (no live Supabase project, no browser session). Once the amended `043_reward_system.sql` has been run in the Supabase SQL Editor, verify by hand in the app:
- Marking a habit done from the Habits page, Quick Log's Habit tab, and voice log all behave the same way (no error, streak updates, coin-burst still fires).
- Catching up a missed habit via the grace-period banner before noon awards points/milestones the same as a same-day completion.
- Completing a habit that crosses a 7-day streak pops the celebration modal with the right point amount; a habit whose streak just broke and restarts does not re-fire a milestone until it re-crosses 7.
- Completing every daily habit in one day pops the overall perfect-day celebration too, once, not again on a later same-day visit.
- `/rewards` shows the points balance, current/best perfect-day streak, and per-habit streak list; adding/editing/deleting a custom reward and redeeming one (affordable and unaffordable) all work.
- Completing a todo increases the points balance by exactly what `TaskRewards.tsx`'s own "Today" card shows for that completion, and `TaskRewards.tsx`'s display is otherwise unaffected.

- [ ] **Step 4: Final commit (only if fixes were needed above)**

```bash
git add -A
git commit -m "fix: address issues found in points engine final verification"
```

Skip entirely if Steps 1–2 passed clean and no code changes were needed.
