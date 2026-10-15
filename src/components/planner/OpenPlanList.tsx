'use client'

import Link from 'next/link'
import { CheckSquare, Circle, Loader2 } from 'lucide-react'
import { completeItem, openNowQuery } from '@/lib/planner/actions'
import { periodStart } from '@/lib/planner/periods'
import { byPriority } from '@/lib/planner/priority'
import type { PeriodType, PlannerItem } from '@/lib/planner/types'
import { todayStr } from '@/lib/habitStreak'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import PriorityFlag from './PriorityFlag'

// Open planner tasks grouped Today / This week / This month, tap to
// complete. Used by the opening briefing (Day at a Glance) and Quick Log.

const MAX_PER_PERIOD = 3

// openNowQuery returns open one-offs for the current day, week AND month,
// so the plan is grouped by period rather than all shown as "today", each
// with its own limit.
const PERIOD_GROUPS: { type: PeriodType; label: string }[] = [
  { type: 'day',   label: 'Today' },
  { type: 'week',  label: 'This week' },
  { type: 'month', label: 'This month' },
]

export default function OpenPlanList({ onNavigate }: { onNavigate: () => void }) {
  const { data: todos, loading, isOffline, setData: setTodos } = useCachedQuery<PlannerItem[]>(
    'quick-reset:planner',
    (supabase, userId) => openNowQuery(supabase, userId, todayStr()),
    [],
    []
  )

  async function complete(todo: PlannerItem) {
    setTodos(prev => prev.filter(t => t.id !== todo.id))
    const restore = () => setTodos(prev => (prev.some(t => t.id === todo.id) ? prev : [...prev, todo]))
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { restore(); return }
      await completeItem(supabase, user.id, todo, todo.period_start, todayStr())
    } catch (err) {
      console.error('Failed to complete planner item', err)
      restore()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-sky-400" />
        <p className="text-sm font-semibold text-white">Your Plan</p>
        {todos.length > 0 && (
          <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">
            {todos.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
      ) : todos.length === 0 && isOffline ? (
        <p className="text-xs text-slate-500 py-2">Can&apos;t load — you&apos;re offline.</p>
      ) : todos.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">All caught up — no pending tasks.</p>
      ) : (
        <div className="space-y-1.5">
          {PERIOD_GROUPS.map(({ type, label }) => {
            // Each period gets its own limit so a busy day can't push the
            // week's and month's tasks out of view.
            const all   = byPriority(todos.filter(t => t.period_type === type))
            const group = all.slice(0, MAX_PER_PERIOD)
            if (group.length === 0) return null
            return (
              <div key={type} className="space-y-1.5">
                <p className="pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
                {group.map(todo => {
                  const overdue = todo.period_start < periodStart(todo.period_type, todayStr())
                  return (
                    <button
                      key={todo.id}
                      onClick={() => complete(todo)}
                      className="group w-full flex items-center gap-3 rounded-lg bg-white/5 hover:bg-sky-500/10 px-3 py-2.5 text-left transition-colors"
                    >
                      <Circle className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-sky-400 transition-colors" />
                      <span className="flex-1 min-w-0 text-sm text-slate-200 group-hover:text-white transition-colors truncate">
                        {todo.title}
                      </span>
                      <PriorityFlag priority={todo.priority} compact />
                      {overdue && <span className="text-xs shrink-0 font-medium text-red-400">Overdue</span>}
                    </button>
                  )
                })}
                {all.length > MAX_PER_PERIOD && (
                  <p className="px-1 text-xs text-slate-500">+{all.length - MAX_PER_PERIOD} more</p>
                )}
              </div>
            )
          })}
          <Link href="/planner" onClick={onNavigate} className="block text-center text-xs text-slate-500 hover:text-violet-400 transition-colors pt-0.5">
            Open planner →
          </Link>
        </div>
      )}
    </div>
  )
}
