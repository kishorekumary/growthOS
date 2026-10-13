'use client'

import Link from 'next/link'
import { ArrowRight, CheckSquare } from 'lucide-react'
import { usePlanner } from '@/hooks/usePlanner'
import { todayStr } from '@/lib/habitStreak'
import { currentPeriods, windowStart } from '@/lib/planner/periods'
import { isDoneIn, isVisibleIn, leftovers } from '@/lib/planner/visibility'
import PeriodList from './PeriodList'

const NO_HABITS: never[] = []
const NO_BUSY: ReadonlySet<string> = new Set()

// Dashboard card: today's planner list with the same one-tap rows. Habits are
// left out here because the TodayHabits card sits right above it.
export default function PlannerWidget() {
  const planner = usePlanner(windowStart(todayStr()))
  const { today } = planner
  const now = currentPeriods(today)

  const dayItems    = planner.items.filter(i => isVisibleIn(i, 'day', now.day))
  const weekOpen    = planner.items.filter(i => isVisibleIn(i, 'week', now.week) && !isDoneIn(i, now.week, planner.completions)).length
  const leftoverCnt = leftovers(planner.items, today).length

  return (
    <div className="space-y-3 rounded-2xl border border-white/8 bg-white/3 p-5">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold text-white">Today&apos;s Plan</span>
        <Link href="/planner" className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400">
          Open planner <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {leftoverCnt > 0 && (
        <Link
          href="/planner?review=1"
          className="block rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/15"
        >
          {leftoverCnt} leftover{leftoverCnt === 1 ? '' : 's'} to review →
        </Link>
      )}

      <PeriodList
        type="day"
        start={now.day}
        today={today}
        variant="tab"
        items={dayItems}
        completions={planner.completions}
        habits={NO_HABITS}
        habitBusy={NO_BUSY}
        itemBusy={planner.busy}
        onAdd={(title, repeats) => planner.add({ title, period_type: 'day', period_start: now.day, repeats })}
        onToggle={item => planner.toggle(item, now.day)}
        onUpdate={planner.update}
        onMove={planner.move}
        onDelete={planner.remove}
        onHabitDone={() => {}}
      />

      {weekOpen > 0 && (
        <Link href="/planner" className="block text-center text-xs text-slate-500 hover:text-violet-400">
          {weekOpen} open this week →
        </Link>
      )}
    </div>
  )
}
