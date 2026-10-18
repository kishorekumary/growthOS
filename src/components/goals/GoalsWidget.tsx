'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Target, Plus, Check, Loader2, ChevronDown, ChevronUp, Maximize2, ArrowRight } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/effects'
import { timeProgress, type Urgency } from '@/lib/goalProgress'
import { Skeleton } from '@/components/ui/skeleton'
import ListClearedBurst from '@/components/shared/ListClearedBurst'
import GoalsFocusModal from './GoalsFocusModal'

type Category = 'fitness' | 'finance' | 'books' | 'general'

interface Goal {
  id: string
  title: string
  description: string | null
  category: Category
  target_date: string | null
  is_completed: boolean
  created_at: string
}

// Full class names per section so Tailwind's scanner picks them up.
const SECTION: Record<Category, { label: string; card: string; tile: string; text: string; bar: string }> = {
  fitness: { label: 'Fitness', card: 'border-emerald-500/20 from-emerald-500/10', tile: 'bg-emerald-500/15 text-emerald-300', text: 'text-emerald-300', bar: 'from-emerald-400 to-teal-500' },
  finance: { label: 'Finance', card: 'border-sky-500/20 from-sky-500/10',         tile: 'bg-sky-500/15 text-sky-300',         text: 'text-sky-300',     bar: 'from-sky-400 to-blue-500' },
  books:   { label: 'Books',   card: 'border-amber-500/20 from-amber-500/10',     tile: 'bg-amber-500/15 text-amber-300',     text: 'text-amber-300',   bar: 'from-amber-300 to-orange-500' },
  general: { label: 'Personal', card: 'border-violet-500/20 from-violet-500/10',  tile: 'bg-violet-500/15 text-violet-300',   text: 'text-violet-300',  bar: 'from-violet-400 to-fuchsia-500' },
}

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-red-400', today: 'text-amber-300', soon: 'text-amber-300', ok: 'text-slate-500', none: 'text-slate-500',
}

function dueLabel(urgency: Urgency, daysLeft: number | null) {
  const n = Math.abs(daysLeft ?? 0)
  if (urgency === 'overdue') return `${n}d overdue`
  if (urgency === 'today') return 'Due today'
  return `${n}d left`
}

// A section's goals (Fitness / Finance / Books), shown at the top of that
// section. One slim line when there are none.
export default function GoalsWidget({ category }: { category: Category }) {
  const { data: goals, loading, isOffline, setData: setGoals } = useCachedQuery<Goal[]>(
    `goals:${category}`,
    (supabase, userId) => supabase
      .from('user_goals')
      .select('id, title, description, category, target_date, is_completed, created_at')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('is_completed', false)
      .order('target_date', { ascending: true, nullsFirst: false }),
    [],
    [category]
  )
  const [open, setOpen]           = useState(true)
  const [focusOpen, setFocusOpen] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [celebrating, setCelebrating] = useState<string | null>(null)
  useEffect(() => {
    if (!celebrating) return
    const t = setTimeout(() => setCelebrating(null), 2200)
    return () => clearTimeout(t)
  }, [celebrating])

  const s = SECTION[category]

  async function markComplete(goal: Goal) {
    setMarkingId(goal.id)
    const supabase = createSupabaseBrowserClient()
    const now = new Date().toISOString()
    await supabase.from('user_goals').update({ is_completed: true, completed_at: now, updated_at: now }).eq('id', goal.id)
    setGoals(prev => prev.filter(g => g.id !== goal.id))
    setMarkingId(null)
    setCelebrating(goal.title)
    haptic('success')
  }

  const burst = celebrating && typeof document !== 'undefined' && createPortal(
    <ListClearedBurst title="Goal achieved!" subtitle={celebrating} emoji="🏆" />, document.body,
  )

  if (loading) return <Skeleton className="mb-6 h-14 w-full rounded-2xl" />

  // Nothing set yet: one slim invitation instead of a whole empty panel.
  if (goals.length === 0) {
    return (
      <>
        {burst}
        <Link
          href="/goals"
          className={cn('card-sheen group mb-6 flex items-center gap-3 rounded-2xl border bg-gradient-to-r to-transparent px-4 py-3 transition-transform active:scale-[0.99]', s.card)}
        >
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', s.tile)}>
            <Target className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 text-sm text-slate-300">
            {isOffline ? <>Can&apos;t load goals while offline</> : <>Set a {s.label.toLowerCase()} goal to aim for</>}
          </span>
          {!isOffline && (
            <span className={cn('flex shrink-0 items-center gap-1 text-xs font-semibold', s.text)}>
              <Plus className="h-3.5 w-3.5" /> Add <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
        </Link>
      </>
    )
  }

  return (
    <div className={cn('card-sheen mb-6 overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent', s.card)}>
      {burst}
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', s.tile)}>
            <Target className="h-3.5 w-3.5" />
          </span>
          <span className={cn('text-sm font-semibold', s.text)}>{s.label} goals</span>
          <span className={cn('rounded-full px-1.5 text-[11px] font-bold leading-5', s.tile)}>{goals.length}</span>
        </span>
        <span className="flex items-center gap-3">
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); setFocusOpen(true) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setFocusOpen(true) } }}
            className="text-slate-500 hover:text-white"
            aria-label="View full screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
          <Link href="/goals" onClick={e => e.stopPropagation()} className={cn('text-xs font-medium hover:brightness-125', s.text)}>
            Manage
          </Link>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
        </span>
      </button>

      <GoalsFocusModal goals={goals} title={`${s.label} Goals`} open={focusOpen} onClose={() => setFocusOpen(false)} />

      {open && (
        <div className="space-y-2 px-4 pb-3">
          {goals.slice(0, 5).map(goal => {
            const tp = timeProgress(goal.created_at, goal.target_date)
            return (
              <div key={goal.id} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => markComplete(goal)}
                    disabled={markingId === goal.id}
                    aria-label="Mark achieved"
                    className="group/check flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white/25 transition-all hover:border-emerald-400 hover:bg-emerald-500/20 active:scale-90"
                  >
                    {markingId === goal.id
                      ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                      : <Check className="h-3 w-3 text-emerald-300 opacity-0 group-hover/check:opacity-100 [@media(hover:none)]:opacity-30" strokeWidth={3} />}
                  </button>
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-200">{goal.title}</p>
                  {goal.target_date && (
                    <span className={cn('shrink-0 text-[11px] font-medium', URGENCY_TEXT[tp.urgency])}>{dueLabel(tp.urgency, tp.daysLeft)}</span>
                  )}
                </div>
                {goal.target_date && (
                  <div className="ml-9 mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r',
                        tp.urgency === 'overdue' ? 'from-red-500 to-rose-400' : tp.urgency === 'ok' ? s.bar : 'from-amber-400 to-orange-400')}
                      style={{ width: `${Math.max(3, tp.elapsed * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {goals.length > 5 ? (
            <button type="button" onClick={() => setFocusOpen(true)} className="block w-full pt-1 text-center text-xs text-slate-500 hover:text-white">
              +{goals.length - 5} more · View all
            </button>
          ) : (
            <Link href="/goals" className="block pt-1 text-center text-xs text-slate-500 hover:text-white">
              View all goals →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
