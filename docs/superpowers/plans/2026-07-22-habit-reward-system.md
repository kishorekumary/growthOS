# Habit Reward System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reward consistent habit performance with points (per-habit streaks + an overall "perfect day" streak), celebrate milestones with a popup, and let the user redeem points against their own self-defined reward catalog.

**Architecture:** Five new Supabase tables store points/streaks/catalog/redemptions/audit-log. Habit-completion logic (currently duplicated across three UI call sites) is consolidated into one new API endpoint, `POST /api/habits/complete`, which owns the streak update, points award, and milestone detection. A React context (mirroring the existing `TimerContext` pattern) queues milestone celebrations for a global popup. A new `/rewards` page lets the user manage their catalog and redeem points.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), no test framework exists in this repo (confirmed: no jest/vitest/tsx in `package.json`, no `*.test.*`/`*.spec.*` files) — verification is `tsc --noEmit`, a full `next build`, and small throwaway Node scripts for pure-logic functions (deleted after use), consistent with how every other feature in this codebase has been verified.

## Global Constraints

- Migrations in this repo are applied manually by the user via the Supabase Dashboard SQL Editor (see `README.md` §3) — never assume a migration has been run against the live database. Every task that depends on the schema existing must still type-check and build against the code; only the user can confirm live DB behavior.
- No new dependencies — everything is built with what's already installed (`lucide-react`, existing Supabase clients, existing `cn` util).
- Follow this repo's existing conventions exactly: `'use client'` client components use `createSupabaseBrowserClient()` from `@/lib/supabase`; server components/API routes use `createSupabaseServerClient()` from `@/lib/supabase-server`; API routes return `NextResponse.json({ error }, { status })` on failure and a data payload on success; new tables get RLS enabled with an `"own data"` policy (`auth.uid() = user_id`) matching `notification_settings`/`briefing_settings`.
- Migration file numbering continues from the latest existing file (`042_briefing_settings.sql`) → next is `043_reward_system.sql`.

---

### Task 1: Database schema — reward system tables

**Files:**
- Create: `supabase/migrations/043_reward_system.sql`

**Interfaces:**
- Produces tables/columns every later task depends on: `user_rewards(user_id, points_balance, current_perfect_streak, longest_perfect_streak, last_perfect_date, last_overall_milestone, updated_at)`, `personality_habits.last_milestone_awarded` (new column), `reward_catalog(id, user_id, title, point_cost, created_at)`, `reward_redemptions(id, user_id, title, point_cost, redeemed_at)`, `reward_points_log(id, user_id, delta, reason, created_at)`, and a Postgres function `increment_points_balance(p_user_id UUID, p_delta INTEGER)`.

- [ ] **Step 1: Write the migration file**

```sql
-- Reward system: points for consistent habit performance, redeemable
-- against a user-defined catalog of real-world rewards.

CREATE TABLE public.user_rewards (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points_balance         INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  current_perfect_streak INTEGER NOT NULL DEFAULT 0,
  longest_perfect_streak INTEGER NOT NULL DEFAULT 0,
  last_perfect_date      DATE,
  last_overall_milestone INTEGER NOT NULL DEFAULT 0,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.user_rewards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Highest per-habit streak milestone already paid out for the CURRENT
-- streak run. Resets to 0 whenever the habit's streak breaks, so the
-- ladder can be re-earned on the next run rather than being a one-time
-- lifetime bonus.
ALTER TABLE public.personality_habits
  ADD COLUMN IF NOT EXISTS last_milestone_awarded INTEGER NOT NULL DEFAULT 0;

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

CREATE TABLE public.reward_catalog (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  point_cost INTEGER NOT NULL CHECK (point_cost > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.reward_catalog
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- History of redemptions. Snapshots title/cost so editing or deleting a
-- catalog item later doesn't change past history.
CREATE TABLE public.reward_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  point_cost  INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.reward_redemptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Audit trail of every point change ("Daily: Meditate", "Milestone:
-- Meditate 30-day streak", "Redeemed: Dinner out") — makes the point
-- balance legible instead of a mysterious number.
CREATE TABLE public.reward_points_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reward_points_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data" ON public.reward_points_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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

- [ ] **Step 2: Verify — this migration cannot be run from this environment**

This repo has no linked Supabase CLI session (confirmed earlier in this project); migrations are applied manually by the user via the Supabase Dashboard SQL Editor. There is nothing to execute locally for this step. Sanity-check the file by reading it back once and confirming: every `CREATE TABLE` has a matching `ALTER ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY "own data"`, matching the exact pattern used in `supabase/migrations/042_briefing_settings.sql`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/043_reward_system.sql
git commit -m "feat: add reward system database schema"
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

There's no test runner in this repo, so verify with a plain Node script (no TS syntax, so it runs directly) and delete it afterward.

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

Expected output: `ALL PASS`. If not, fix `src/lib/rewardMilestones.ts` (the logic under test is copy-identical to what's in that file — keep them in sync while debugging, then delete the script).

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output (no errors).

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
- Consumes: nothing (pure function, no imports from other tasks).
- Produces: `isPerfectDay(habits: { id: string; frequency: 'daily' | 'weekly' }[], logsToday: { habit_id: string; status: 'done' | 'missed' }[]): boolean`. Task 4 imports this.

- [ ] **Step 1: Write the file**

```ts
export interface DailyHabitLike { id: string; frequency: 'daily' | 'weekly' }
export interface HabitLogLike   { habit_id: string; status: 'done' | 'missed' }

// A day counts as "perfect" if every *daily*-frequency habit (weekly
// habits excluded — they don't need daily action) has a log for that
// day, whether 'done' or 'missed' (skipped). Only a habit left with NO
// log at all — i.e. still pending, actionable — blocks "perfect". This
// matches HabitTracker.tsx's own convention of excluding missed habits
// from its "X/Y done today" tally.
//
// A user with zero daily habits can never have a "perfect day" — there's
// nothing to be perfect about.
export function isPerfectDay(habits: DailyHabitLike[], logsToday: HabitLogLike[]): boolean {
  const dailyHabits = habits.filter(h => h.frequency === 'daily')
  if (dailyHabits.length === 0) return false
  const loggedIds = new Set(logsToday.map(l => l.habit_id))
  return dailyHabits.every(h => loggedIds.has(h.id))
}
```

- [ ] **Step 2: Verify with a throwaway script**

```bash
cat > /tmp/verify-perfect-day.mjs << 'EOF'
function isPerfectDay(habits, logsToday) {
  const dailyHabits = habits.filter(h => h.frequency === 'daily')
  if (dailyHabits.length === 0) return false
  const loggedIds = new Set(logsToday.map(l => l.habit_id))
  return dailyHabits.every(h => loggedIds.has(h.id))
}

const cases = [
  { name: 'no habits at all',                habits: [],                                                                    logs: [],                                             expected: false },
  { name: 'one daily habit, done',           habits: [{ id: 'a', frequency: 'daily' }],                                     logs: [{ habit_id: 'a', status: 'done' }],            expected: true  },
  { name: 'one daily habit, missed (skip)',  habits: [{ id: 'a', frequency: 'daily' }],                                     logs: [{ habit_id: 'a', status: 'missed' }],          expected: true  },
  { name: 'one daily habit, no log (pending)', habits: [{ id: 'a', frequency: 'daily' }],                                   logs: [],                                             expected: false },
  { name: 'weekly habit excluded, no log',   habits: [{ id: 'a', frequency: 'daily' }, { id: 'b', frequency: 'weekly' }],    logs: [{ habit_id: 'a', status: 'done' }],            expected: true  },
  { name: 'two daily, one pending',          habits: [{ id: 'a', frequency: 'daily' }, { id: 'b', frequency: 'daily' }],     logs: [{ habit_id: 'a', status: 'done' }],            expected: false },
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

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/perfectDay.ts
git commit -m "feat: add perfect-day detection logic"
```

---

### Task 4: Consolidated habit-completion API endpoint

**Files:**
- Create: `src/app/api/habits/complete/route.ts`

**Interfaces:**
- Consumes: `highestMilestoneCrossed`, `PER_HABIT_MILESTONE_POINTS`, `OVERALL_MILESTONE_POINTS`, `DAILY_POINTS`, `DAILY_POINTS_KEYSTONE` from `@/lib/rewardMilestones` (Task 2); `isPerfectDay` from `@/lib/perfectDay` (Task 3); `createSupabaseServerClient` from `@/lib/supabase-server`.
- Produces: `POST /api/habits/complete` — body `{ habit_id: string }`, response `{ streak_count: number, milestones: { label: string; points: number }[] }` on success, `{ error: string }` with a non-2xx status on failure. Tasks 5, 8, 9, 10 depend on this exact request/response shape.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  highestMilestoneCrossed, PER_HABIT_MILESTONE_POINTS, OVERALL_MILESTONE_POINTS,
  DAILY_POINTS, DAILY_POINTS_KEYSTONE,
} from '@/lib/rewardMilestones'
import { isPerfectDay } from '@/lib/perfectDay'

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

interface Milestone { label: string; points: number }

function todayStr(): string {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

// Identical logic to HabitTracker.tsx / QuickLog.tsx's client-side computeStreak —
// duplicated here since one runs in the browser and this runs on the server.
function computeStreak(current: number, lastDoneAt: string | null, frequency: 'daily' | 'weekly'): number {
  if (!lastDoneAt) return 1
  const last  = new Date(lastDoneAt); last.setHours(0, 0, 0, 0)
  const today = new Date();          today.setHours(0, 0, 0, 0)
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

async function awardPoints(supabase: SupabaseClient, userId: string, delta: number, reason: string) {
  await supabase.from('reward_points_log').insert({ user_id: userId, delta, reason })
  await supabase.rpc('increment_points_balance', { p_user_id: userId, p_delta: delta })
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { habit_id } = await req.json()
  if (!habit_id) return NextResponse.json({ error: 'habit_id required' }, { status: 400 })

  const { data: habit, error: habitErr } = await supabase
    .from('personality_habits')
    .select('id, habit_name, streak_count, longest_streak, last_done_at, frequency, is_keystone, is_global, last_milestone_awarded')
    .eq('id', habit_id)
    .single()
  if (habitErr || !habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  const today = todayStr()
  const now   = new Date().toISOString()
  const milestones: Milestone[] = []

  // 1. Upsert today's log as done
  await supabase.from('habit_logs').upsert(
    { user_id: user.id, habit_id: habit.id, log_date: today, status: 'done' },
    { onConflict: 'habit_id,user_id,log_date' }
  )

  // 2. Update streak — skipped for global habits (shared row across every
  // user, so no per-user streak can live on it; matches existing client behavior).
  let newStreak = habit.streak_count
  if (!habit.is_global) {
    newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)
    await supabase.from('personality_habits').update({
      streak_count:   newStreak,
      longest_streak: Math.max(newStreak, habit.longest_streak),
      last_done_at:   now,
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

  // 6. Perfect-day check — includes global habits, since they're visible
  // in every user's tracker too.
  const [{ data: dailyHabits }, { data: logsToday }, { data: rewards }] = await Promise.all([
    supabase.from('personality_habits').select('id, frequency')
      .or(`user_id.eq.${user.id},is_global.eq.true`).eq('frequency', 'daily'),
    supabase.from('habit_logs').select('habit_id, status')
      .eq('user_id', user.id).eq('log_date', today),
    supabase.from('user_rewards').select('current_perfect_streak, longest_perfect_streak, last_perfect_date, last_overall_milestone')
      .eq('user_id', user.id).single(),
  ])

  if (rewards && isPerfectDay(dailyHabits ?? [], logsToday ?? []) && rewards.last_perfect_date !== today) {
    const yesterday      = yesterdayStr()
    const newPerfect     = rewards.last_perfect_date === yesterday ? rewards.current_perfect_streak + 1 : 1
    const longestPerfect = Math.max(newPerfect, rewards.longest_perfect_streak)
    const overallBaseline = newPerfect === 1 ? 0 : rewards.last_overall_milestone
    const overallCrossed  = highestMilestoneCrossed(newPerfect)

    await supabase.from('user_rewards').update({
      current_perfect_streak: newPerfect,
      longest_perfect_streak: longestPerfect,
      last_perfect_date:      today,
      last_overall_milestone: overallCrossed > overallBaseline ? overallCrossed : overallBaseline,
      updated_at:             now,
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

- [ ] **Step 2: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output. This confirms the route compiles against `@/lib/rewardMilestones`, `@/lib/perfectDay`, and `@/lib/supabase-server`'s actual exported signatures — it cannot confirm live database behavior (no linked Supabase project in this environment; requires Task 1's migration to actually be applied).

- [ ] **Step 3: Manual walkthrough (no live DB available — reasoning check, not an execution)**

Read through the six numbered steps in the route against the spec's "Where the logic lives" section (`docs/superpowers/specs/2026-07-22-habit-reward-system-design.md`) and confirm each of the following by inspection:
- A global habit (`is_global: true`) never gets a `personality_habits` write for streak or milestone (steps 2 and 5 both check `!habit.is_global`), but still earns daily points (step 4) and still counts toward the perfect-day check (step 6 queries `.or(user_id.eq...,is_global.eq.true)`).
- A broken-and-rebuilt streak (`newStreak === 1`) resets `last_milestone_awarded` to 0 before checking crossing, so a 7-day milestone can fire again on a fresh run.
- Calling this endpoint twice in the same day for the same already-perfect day is a no-op for the overall streak (guarded by `rewards.last_perfect_date !== today`), matching the spec's "no streak-loss point penalty" / no double-counting requirement.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/habits/complete/route.ts
git commit -m "feat: add consolidated habit-completion API endpoint"
```

---

### Task 5: Client helper for calling the completion endpoint

**Files:**
- Create: `src/lib/completeHabit.ts`

**Interfaces:**
- Produces: `interface RewardMilestone { label: string; points: number }`, `completeHabit(habitId: string): Promise<{ streak_count: number; milestones: RewardMilestone[] }>`. Tasks 6, 8, 9, 10 import from this file.

- [ ] **Step 1: Write the file**

```ts
export interface RewardMilestone { label: string; points: number }

export async function completeHabit(habitId: string): Promise<{ streak_count: number; milestones: RewardMilestone[] }> {
  const res = await fetch('/api/habits/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habit_id: habitId }),
  })
  if (!res.ok) throw new Error('Failed to complete habit')
  return res.json()
}
```

- [ ] **Step 2: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
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

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
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

In `src/app/(main)/layout.tsx`, add these two imports alongside the existing `TimerProvider`/`FloatingTimer` imports:

```ts
import { RewardProvider } from '@/contexts/RewardContext'
import RewardMilestoneModal from '@/components/shared/RewardMilestoneModal'
```

- [ ] **Step 2: Wrap the tree and render the modal**

Change:

```tsx
  return (
    <TimerProvider>
    <div className="min-h-screen text-white">
```

to:

```tsx
  return (
    <TimerProvider>
    <RewardProvider>
    <div className="min-h-screen text-white">
```

And change the closing tags at the end of the returned JSX from:

```tsx
    </div>
    </TimerProvider>
  )
}
```

to:

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
```

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
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

- [ ] **Step 1: Add imports**

Add to the top of `src/components/personality/HabitTracker.tsx`:

```ts
import { completeHabit } from '@/lib/completeHabit'
import { useReward } from '@/contexts/RewardContext'
```

- [ ] **Step 2: Call the hook inside the component**

Inside `export default function HabitTracker() {`, add alongside the existing `useState` calls:

```ts
  const { celebrateMilestones } = useReward()
```

- [ ] **Step 3: Replace markDone's direct Supabase writes**

Replace this entire function:

```ts
  async function markDone(habit: Habit) {
    if (getStatus(habit.id) !== 'pending' || markingId || !userId) return
    setMarkingId(habit.id)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)
    const now   = new Date().toISOString()
    const today = todayStr()

    // Optimistic update
    setHabits(prev => prev.map(h => h.id === habit.id
      ? { ...h, streak_count: newStreak, longest_streak: Math.max(newStreak, h.longest_streak), last_done_at: now }
      : h
    ))
    setWeekLogs(prev => [
      ...prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)),
      { habit_id: habit.id, log_date: today, status: 'done' },
    ])

    const supabase = createSupabaseBrowserClient()
    const logPromise = supabase.from('habit_logs').upsert(
      { user_id: userId, habit_id: habit.id, log_date: today, status: 'done' },
      { onConflict: 'habit_id,user_id,log_date' }
    )
    const [, logsRes] = await Promise.all([
      // Global habits track no per-user streak on the habit row itself
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
    setMarkingId(null)
  }
```

with:

```ts
  async function markDone(habit: Habit) {
    if (getStatus(habit.id) !== 'pending' || markingId || !userId) return
    setMarkingId(habit.id)
    const today = todayStr()

    // Optimistic update — streak_count is refined once the server responds
    setWeekLogs(prev => [
      ...prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)),
      { habit_id: habit.id, log_date: today, status: 'done' },
    ])

    try {
      const { streak_count, milestones } = await completeHabit(habit.id)
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: new Date().toISOString() }
        : h
      ))
      celebrateMilestones(milestones)
    } catch {
      setLogsUnavail(true)
    }
    setMarkingId(null)
  }
```

- [ ] **Step 4: Delete the now-unused computeStreak function**

`computeStreak` (module-level function, originally at the top of the file) was only ever called from `markDone`. Delete this function entirely:

```ts
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

- [ ] **Step 5: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output. If `computeStreak` is reported as still referenced somewhere, do not delete it — find the remaining call site first (there should be none; `undoLog` computes its reverse streak inline via `Math.max(0, habit.streak_count - 1)` and does not call `computeStreak`).

- [ ] **Step 6: Commit**

```bash
git add src/components/personality/HabitTracker.tsx
git commit -m "refactor: HabitTracker markDone uses the consolidated completion endpoint"
```

---

### Task 9: Migrate QuickLog.tsx's HabitPanel to the consolidated endpoint

**Files:**
- Modify: `src/components/shared/QuickLog.tsx`

**Interfaces:**
- Consumes: `completeHabit` from `@/lib/completeHabit` (Task 5), `useReward` from `@/contexts/RewardContext` (Task 6).

- [ ] **Step 1: Add imports**

Add to the top of `src/components/shared/QuickLog.tsx`, alongside the existing `useCachedQuery`/`useDraggableFab`/`habitCategories` imports:

```ts
import { completeHabit } from '@/lib/completeHabit'
import { useReward } from '@/contexts/RewardContext'
```

- [ ] **Step 2: Call the hook inside HabitPanel**

Inside `function HabitPanel() {`, add alongside its existing `useState` calls:

```ts
  const { celebrateMilestones } = useReward()
```

- [ ] **Step 3: Replace HabitPanel's markDone**

Replace this entire function:

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
        { onConflict: 'habit_id,log_date' }
      ),
    ])
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
      celebrateMilestones(milestones)
    } catch {
      setDoneIds(prev => { const s = new Set(prev); s.delete(habit.id); return s })
    }
    setMarkingId(null)
  }
```

- [ ] **Step 4: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output. `computeStreak` is still used by `VoicePanel` at this point (migrated in Task 10) — do not delete it yet.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/QuickLog.tsx
git commit -m "refactor: QuickLog HabitPanel markDone uses the consolidated completion endpoint"
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
            { onConflict: 'habit_id,log_date' }
          ),
        ])
      } else if (result.type === 'journal') {
```

with:

```ts
      } else if (result.type === 'habit' && matchedHabit) {
        const { milestones } = await completeHabit(matchedHabit.id)
        celebrateMilestones(milestones)
      } else if (result.type === 'journal') {
```

Leave every other branch (`transaction`, `workout`, `meal`, `journal`) exactly as-is — only the `habit` branch changes.

- [ ] **Step 3: Delete the now-unused computeStreak function**

With both `HabitPanel` (Task 9) and `VoicePanel` (this task) migrated, `computeStreak` (module-level, near the top of `QuickLog.tsx`) has no remaining callers. Delete this function entirely:

```ts
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

- [ ] **Step 4: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output. If `computeStreak` is reported as still referenced, search for it before re-deleting — every call site should already be gone after Tasks 9 and 10.

- [ ] **Step 5: Commit**

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

- [ ] **Step 2: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
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

- [ ] **Step 2: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
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
          <p className="text-xs text-slate-500 mt-0.5">Best: {longestPerfectStreak}</p>
        </div>
      </div>

      {streaks.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-sm font-semibold text-white">Habit Streaks</p>
          <div className="space-y-1.5">
            {streaks.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{h.habit_name}</span>
                <span className="text-orange-400 font-medium">🔥 {h.streak_count}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
        <p className="text-sm font-semibold text-white">Your Rewards</p>

        {!seeded && catalog.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <Gift className="h-8 w-8 text-amber-400/40 mx-auto" />
            <p className="text-sm text-slate-400">No rewards yet — start with a few ideas?</p>
            <button
              onClick={seedStarters}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-all"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Add starter rewards
            </button>
          </div>
        )}

        <div className="space-y-2">
          {catalog.map(item => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
              {editingId === item.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="number" min={1} value={editCost} onChange={e => setEditCost(e.target.value)}
                    className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                  <button onClick={() => saveEdit(item.id)} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium px-2">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white text-xs px-2">Cancel</button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{item.title}</p>
                    <p className="text-xs text-amber-400">{item.point_cost} pts</p>
                  </div>
                  <button
                    onClick={() => redeem(item)}
                    disabled={balance < item.point_cost || !!redeemingId}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                      balance >= item.point_cost
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-white/5 text-slate-600 cursor-not-allowed',
                    )}
                  >
                    {redeemingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Redeem'}
                  </button>
                  <button onClick={() => startEdit(item)} className="text-slate-600 hover:text-violet-400 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteReward(item.id)} disabled={deletingId === item.id} className="text-slate-600 hover:text-red-400 transition-colors">
                    {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t border-white/5">
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="New reward…"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
          <input
            type="number" min={1} value={newCost} onChange={e => setNewCost(e.target.value)}
            placeholder="pts"
            className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={addReward}
            disabled={adding || !newTitle.trim() || !newCost}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {redemptions.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-sm font-semibold text-white">Redemption History</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {redemptions.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{r.title}</span>
                <span className="text-xs text-slate-600">{r.point_cost} pts · {new Date(r.redeemed_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
git add "src/app/(main)/rewards/page.tsx" "src/app/(main)/rewards/RewardsClient.tsx"
git commit -m "feat: add /rewards page for points, streaks, and catalog management"
```

---

### Task 14: Navigation links

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/MobileDrawer.tsx`

**Interfaces:**
- Consumes: the `/rewards` route from Task 13.

- [ ] **Step 1: Add the icon import and nav entry in Sidebar.tsx**

Change:

```ts
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, Search,
} from 'lucide-react'
```

to:

```ts
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, Search, Gift,
} from 'lucide-react'
```

Change:

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

to:

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

- [ ] **Step 2: Make the same change in MobileDrawer.tsx**

`MobileDrawer.tsx` has the exact same `NAV_ITEMS` array (pre-existing duplication between the two files — not something to refactor as part of this task). Change:

```ts
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, X,
} from 'lucide-react'
```

to:

```ts
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, X, Gift,
} from 'lucide-react'
```

Change:

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

to:

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

- [ ] **Step 3: Run the project type checker**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/MobileDrawer.tsx
git commit -m "feat: add Rewards link to sidebar and mobile drawer navigation"
```

---

### Task 15: Final full build and manual verification checklist

**Files:** none (verification only).

- [ ] **Step 1: Full production build**

```bash
rm -rf .next && npm run build
```

Expected: build completes with no errors, and the route list includes `/rewards`.

- [ ] **Step 2: Confirm no stray references to removed code**

```bash
command grep -rn "computeStreak" src/components/personality/HabitTracker.tsx src/components/shared/QuickLog.tsx
```

Expected: no output (both were deleted in Tasks 8 and 10).

- [ ] **Step 3: Manual walkthrough checklist for the user**

This cannot be executed from this environment (no live Supabase project, no browser session). Once `043_reward_system.sql` has been run in the Supabase SQL Editor, verify by hand in the app:
- Marking a habit done from the Habits page shows no error and the streak number updates.
- Marking a habit done from the Quick Log popup's Habit tab behaves the same way.
- Using voice log ("did yoga", etc. mapped to a habit) behaves the same way.
- Completing a habit that crosses a 7-day streak pops up the celebration modal with the right point amount.
- Completing every daily habit in one day (a "perfect day") pops up the overall-streak celebration too, once, not on every subsequent visit that same day.
- `/rewards` shows the points balance, current/best perfect-day streak, and per-habit streak list.
- Adding, editing, and deleting a custom reward on `/rewards` all work.
- Redeeming a reward you can afford deducts points and appears in redemption history; redeeming one you can't afford is blocked (button disabled).

- [ ] **Step 4: Final commit (only if any fixes were needed above)**

```bash
git add -A
git commit -m "fix: address issues found in reward system final verification"
```

Skip this step entirely if step 1–2 passed clean and no code changes were needed.
