'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Target, ArrowRight, Plus, Calendar, Maximize2 } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import GoalsFocusModal from './GoalsFocusModal'

type Category = 'fitness' | 'finance' | 'books' | 'general' | 'career'
type Timeframe = 'week' | 'month' | 'year' | 'custom'

interface Goal {
  id: string
  title: string
  category: Category
  timeframe: Timeframe
  target_date: string | null
  is_completed: boolean
}

const CATEGORY_DOT: Record<Category, string> = {
  fitness: 'bg-emerald-400',
  finance: 'bg-sky-400',
  books:   'bg-amber-400',
  general: 'bg-violet-400',
  career:  'bg-rose-400',
}

const CATEGORY_BADGE: Record<Category, string> = {
  fitness: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
  finance: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
  books:   'bg-amber-500/15 text-amber-300 border border-amber-500/25',
  general: 'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  career:  'bg-rose-500/15 text-rose-300 border border-rose-500/25',
}

const URGENCY_ORDER: Record<string, number> = { week: 0, month: 1, year: 2, custom: 3 }

function effectiveTimeframe(goal: Goal): Timeframe {
  if (!goal.target_date) return goal.timeframe
  const days = differenceInDays(parseISO(goal.target_date), new Date())
  if (days <= 7)   return 'week'
  if (days <= 31)  return 'month'
  if (days <= 365) return 'year'
  return 'custom'
}

function CountdownBadge({ targetDate }: { targetDate: string }) {
  const days = differenceInDays(parseISO(targetDate), new Date())
  if (days < 0)   return <span className="flex items-center gap-1 text-xs text-red-300"><Calendar className="h-2.5 w-2.5" />Overdue</span>
  if (days === 0) return <span className="flex items-center gap-1 text-xs text-amber-300"><Calendar className="h-2.5 w-2.5" />Today</span>
  if (days <= 7)  return <span className="flex items-center gap-1 text-xs text-amber-300"><Calendar className="h-2.5 w-2.5" />{days}d left</span>
  if (days <= 31) return <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="h-2.5 w-2.5" />{Math.ceil(days / 7)}w left</span>
  return <span className="flex items-center gap-1 text-xs text-slate-500"><Calendar className="h-2.5 w-2.5" />{Math.ceil(days / 30)}mo left</span>
}

export default function DashboardGoalsCard({ goals }: { goals: Goal[] }) {
  const [focusOpen, setFocusOpen] = useState(false)

  const allActive = goals
    .filter(g => !g.is_completed)
    .sort((a, b) => URGENCY_ORDER[effectiveTimeframe(a)] - URGENCY_ORDER[effectiveTimeframe(b)])

  const active      = allActive.slice(0, 5)
  const totalActive = allActive.length

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/90 p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20">
            <Target className="h-4 w-4 text-violet-400" />
          </div>
          <span className="text-sm font-semibold text-white">Goals</span>
          {totalActive > 0 && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-300">
              {totalActive} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalActive > 0 && (
            <button
              onClick={() => setFocusOpen(true)}
              className="text-slate-500 hover:text-violet-400 transition-colors"
              aria-label="View full screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          <Link
            href="/goals"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-300 transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5 text-center gap-3">
          <p className="text-sm text-slate-400">No active goals yet.</p>
          <Link
            href="/goals"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-600/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add your first goal
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {active.map(goal => (
            <div
              key={goal.id}
              className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[goal.category]}`} />
              <span className="flex-1 min-w-0 text-sm text-slate-200 truncate">{goal.title}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {goal.target_date
                  ? <CountdownBadge targetDate={goal.target_date} />
                  : null}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CATEGORY_BADGE[goal.category]}`}>
                  {goal.category}
                </span>
              </div>
            </div>
          ))}

          {totalActive > 5 && (
            <button
              onClick={() => setFocusOpen(true)}
              className="block w-full text-center text-xs text-slate-500 hover:text-violet-300 transition-colors pt-1"
            >
              +{totalActive - 5} more goals · View all
            </button>
          )}
        </div>
      )}

      <GoalsFocusModal
        goals={allActive}
        title="Active Goals"
        open={focusOpen}
        onClose={() => setFocusOpen(false)}
      />
    </div>
  )
}
