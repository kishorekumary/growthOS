'use client'

import { cn } from '@/lib/utils'
import type { PlannerHabit } from '@/hooks/usePlannerHabits'
import CheckCircle from './CheckCircle'
import StreakFlame from '@/components/ui/streak-flame'

export default function HabitRow({ habit, busy, onDone }: {
  habit:  PlannerHabit
  busy:   boolean
  onDone: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-3 transition-colors',
        habit.done ? 'bg-emerald-500/[0.06]' : 'bg-white/[0.04]',
      )}
      title={habit.done ? 'Undo from the Habits page' : undefined}
    >
      <CheckCircle checked={habit.done} disabled={habit.done || busy} label={`Mark ${habit.habit_name} done`} onClick={onDone} />
      <span className={cn('min-w-0 flex-1 break-words text-sm', habit.done ? 'text-slate-500 line-through' : 'text-white')}>
        {habit.habit_name}
      </span>
      {habit.streak_count > 0 && (
        <span className="shrink-0 rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-300">
          <StreakFlame seed={habit.streak_count} /> {habit.streak_count}
        </span>
      )}
    </div>
  )
}
