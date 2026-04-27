'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Target, Plus, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { differenceInDays, isPast, parseISO } from 'date-fns'

type Category = 'fitness' | 'finance' | 'books' | 'general'

interface Goal {
  id: string
  title: string
  description: string | null
  category: Category
  target_date: string | null
  is_completed: boolean
}

const CATEGORY_LABELS: Record<Category, string> = {
  fitness: 'Fitness',
  finance: 'Finance',
  books:   'Books',
  general: 'General',
}

function DateBadge({ targetDate }: { targetDate: string }) {
  const date = parseISO(targetDate)
  const days = differenceInDays(date, new Date())
  const overdue = isPast(date) && days < 0

  if (overdue) {
    return (
      <span className="text-xs text-red-400 shrink-0">
        {Math.abs(days)}d overdue
      </span>
    )
  }
  if (days === 0) return <span className="text-xs text-amber-400 shrink-0">Due today</span>
  if (days <= 7)  return <span className="text-xs text-amber-400 shrink-0">{days}d left</span>
  return <span className="text-xs text-slate-500 shrink-0">{days}d left</span>
}

export default function GoalsWidget({ category }: { category: Category }) {
  const [goals, setGoals]     = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const { data } = await supabase
      .from('user_goals')
      .select('id, title, description, category, target_date, is_completed')
      .eq('user_id', session.user.id)
      .eq('category', category)
      .eq('is_completed', false)
      .order('target_date', { ascending: true, nullsFirst: false })
      .limit(5)
    setGoals((data as Goal[]) ?? [])
    setLoading(false)
  }, [category])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  async function markComplete(id: string) {
    setMarkingId(id)
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('user_goals')
      .update({ is_completed: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
    setMarkingId(null)
  }

  const label = CATEGORY_LABELS[category]

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden mb-6">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-400 shrink-0" />
          <span className="text-sm font-semibold text-violet-300">{label} Goals</span>
          {!loading && goals.length > 0 && (
            <span className="text-xs bg-violet-500/30 text-violet-200 px-1.5 py-0.5 rounded-full">
              {goals.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/goals"
            onClick={e => e.stopPropagation()}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Manage
          </Link>
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
            : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          }
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-violet-500/10 px-4 pb-3 pt-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            </div>
          ) : goals.length === 0 ? (
            <div className="flex items-center justify-between py-1">
              <p className="text-xs text-slate-500">No {label.toLowerCase()} goals yet.</p>
              <Link
                href="/goals"
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add one
              </Link>
            </div>
          ) : (
            <>
              {goals.map(goal => (
                <div
                  key={goal.id}
                  className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => markComplete(goal.id)}
                    disabled={markingId === goal.id}
                    aria-label="Mark complete"
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                      markingId === goal.id
                        ? 'border-slate-600 cursor-wait'
                        : 'border-violet-500/60 hover:border-violet-400 hover:bg-violet-500/20 cursor-pointer'
                    )}
                  >
                    {markingId === goal.id
                      ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                      : <Check className="h-3 w-3 text-violet-400 opacity-0 group-hover:opacity-100" />
                    }
                  </button>

                  <p className="flex-1 text-sm text-slate-200 truncate">{goal.title}</p>

                  {goal.target_date && <DateBadge targetDate={goal.target_date} />}
                </div>
              ))}

              <Link
                href="/goals"
                className="block text-center text-xs text-slate-500 hover:text-violet-400 transition-colors pt-1"
              >
                View all goals →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
