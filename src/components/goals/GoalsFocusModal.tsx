'use client'

import { X, Target } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

export interface FocusGoal {
  id: string
  title: string
  description?: string | null
  category: string
  target_date: string | null
}

const CATEGORY_DOT: Record<string, string> = {
  fitness: 'bg-emerald-400',
  finance: 'bg-sky-400',
  books:   'bg-amber-400',
  general: 'bg-violet-400',
  career:  'bg-rose-400',
}

function DateBadge({ targetDate }: { targetDate: string }) {
  const days = differenceInDays(parseISO(targetDate), new Date())
  if (days < 0)   return <span className="text-xs text-red-400 shrink-0">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="text-xs text-amber-300 shrink-0">Due today</span>
  if (days <= 7)  return <span className="text-xs text-amber-400 shrink-0">{days}d left</span>
  if (days <= 30) return <span className="text-xs text-slate-400 shrink-0">{Math.ceil(days / 7)}w left</span>
  return <span className="text-xs text-slate-500 shrink-0">{Math.ceil(days / 30)}mo left</span>
}

export default function GoalsFocusModal({
  goals,
  title,
  open,
  onClose,
}: {
  goals: FocusGoal[]
  title: string
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">{title}</span>
            {goals.length > 0 && (
              <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                {goals.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Goals list */}
        <div className="px-4 py-3 max-h-[65vh] overflow-y-auto space-y-2">
          {goals.length === 0 ? (
            <div className="text-center py-10">
              <Target className="h-8 w-8 text-violet-400/30 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No active goals.</p>
            </div>
          ) : (
            goals.map(goal => (
              <div key={goal.id} className="rounded-xl bg-white/5 px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full mt-1', CATEGORY_DOT[goal.category] ?? 'bg-slate-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug">{goal.title}</p>
                    {goal.description && (
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{goal.description}</p>
                    )}
                  </div>
                  {goal.target_date && <DateBadge targetDate={goal.target_date} />}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
