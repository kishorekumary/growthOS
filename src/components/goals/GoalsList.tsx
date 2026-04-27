'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Target, Plus, Check, Trash2, Loader2, AlertCircle,
  Dumbbell, Wallet, BookOpen, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format, differenceInDays, isPast, parseISO } from 'date-fns'

type Category = 'fitness' | 'finance' | 'books' | 'general'
type FilterTab = 'all' | Category

interface Goal {
  id: string
  title: string
  description: string | null
  category: Category
  target_date: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

const CATEGORY_CONFIG: Record<Category, { label: string; icon: typeof Target; color: string; bg: string; border: string }> = {
  fitness: { label: 'Fitness', icon: Dumbbell, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  finance: { label: 'Finance', icon: Wallet,   color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  books:   { label: 'Books',   icon: BookOpen, color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  general: { label: 'General', icon: Sparkles, color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
}

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'finance', label: 'Finance' },
  { value: 'books',   label: 'Books' },
  { value: 'general', label: 'General' },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function DateStatus({ targetDate }: { targetDate: string }) {
  const date = parseISO(targetDate)
  const days = differenceInDays(date, new Date())
  const formatted = format(date, 'MMM d, yyyy')

  if (isPast(date) && days < 0) {
    return (
      <span className="text-xs text-red-400">
        {formatted} · {Math.abs(days)}d overdue
      </span>
    )
  }
  if (days === 0) return <span className="text-xs text-amber-400">{formatted} · Due today</span>
  if (days <= 7)  return <span className="text-xs text-amber-400">{formatted} · {days}d left</span>
  if (days <= 30) return <span className="text-xs text-slate-400">{formatted} · {days}d left</span>
  return <span className="text-xs text-slate-500">{formatted}</span>
}

// ─── Add Goal Modal ───────────────────────────────────────────

function AddGoalModal({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen]           = useState(false)
  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [category, setCategory]   = useState<Category>('general')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleAdd() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setError('Not signed in. Please refresh.')
      setSaving(false)
      return
    }
    const { error: err } = await supabase.from('user_goals').insert({
      user_id:     session.user.id,
      title:       title.trim(),
      description: description.trim() || null,
      category,
      target_date: targetDate || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setTitle(''); setDesc(''); setCategory('general'); setTargetDate('')
    setSaving(false)
    setOpen(false)
    onAdd()
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setError(null) }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
          <Plus className="h-4 w-4" /> Add Goal
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Goal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Goal title</Label>
            <Input
              autoFocus
              placeholder="e.g. Run a half marathon"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Category</Label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]).map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border py-2.5 px-2 text-xs font-medium transition-all',
                      category === key
                        ? 'border-violet-500 bg-violet-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', category === key ? 'text-white' : cfg.color)} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Target date (optional)</Label>
            <input
              type="date"
              value={targetDate}
              min={todayStr()}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Description (optional)</Label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Why is this goal important to you?"
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleAdd}
            disabled={saving || !title.trim()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Goal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function GoalsList() {
  const [goals, setGoals]         = useState<Goal[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<FilterTab>('all')
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const fetchGoals = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const { data } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_completed', { ascending: true })
      .order('target_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    setGoals((data as Goal[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  async function markComplete(id: string) {
    setMarkingId(id)
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('user_goals')
      .update({ is_completed: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, is_completed: true, completed_at: new Date().toISOString() } : g))
    setMarkingId(null)
  }

  async function deleteGoal(id: string) {
    setDeletingId(id)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
    setDeletingId(null)
  }

  const filtered = goals.filter(g =>
    (filter === 'all' || g.category === filter)
  )
  const active    = filtered.filter(g => !g.is_completed)
  const completed = filtered.filter(g => g.is_completed)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">
            {active.length} active goal{active.length !== 1 ? 's' : ''}
          </h2>
          {completed.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{completed.length} completed</p>
          )}
        </div>
        <AddGoalModal onAdd={fetchGoals} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 overflow-x-auto">
        {FILTER_TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-lg py-1.5 px-2 text-center text-xs font-medium transition-all',
              filter === value
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {active.length === 0 && completed.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Target className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No {filter === 'all' ? '' : filter + ' '}goals yet.</p>
          <p className="text-slate-600 text-xs mt-1">Set a goal with a target date to stay on track.</p>
        </div>
      )}

      {/* Active goals */}
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(goal => {
            const cfg = CATEGORY_CONFIG[goal.category]
            const Icon = cfg.icon
            return (
              <div
                key={goal.id}
                className={cn(
                  'group flex items-start gap-3 rounded-xl border p-4 transition-all',
                  cfg.border, cfg.bg
                )}
              >
                {/* Complete button */}
                <button
                  type="button"
                  onClick={() => markComplete(goal.id)}
                  disabled={!!markingId}
                  aria-label="Mark complete"
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    'border-white/30 hover:border-emerald-400 hover:bg-emerald-500/20 cursor-pointer'
                  )}
                >
                  {markingId === goal.id
                    ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    : <Check className="h-3 w-3 text-white opacity-0 group-hover:opacity-60" />
                  }
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start gap-2 justify-between">
                    <p className="text-sm font-medium text-white leading-snug">{goal.title}</p>
                    <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full shrink-0', cfg.bg, cfg.color, 'border', cfg.border)}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                  {goal.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">{goal.description}</p>
                  )}
                  {goal.target_date && <DateStatus targetDate={goal.target_date} />}
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => deleteGoal(goal.id)}
                  disabled={deletingId === goal.id}
                  aria-label="Delete goal"
                  className="shrink-0 mt-0.5 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                >
                  {deletingId === goal.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed goals (collapsible) */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors"
          >
            {showCompleted ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Completed ({completed.length})
          </button>

          {showCompleted && (
            <div className="space-y-2">
              {completed.map(goal => {
                const cfg = CATEGORY_CONFIG[goal.category]
                const Icon = cfg.icon
                return (
                  <div
                    key={goal.id}
                    className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/3 p-4 opacity-60"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/30 border-2 border-emerald-500">
                      <Check className="h-3 w-3 text-emerald-400" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start gap-2 justify-between">
                        <p className="text-sm font-medium text-slate-400 line-through leading-snug">{goal.title}</p>
                        <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full shrink-0', cfg.bg, cfg.color)}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      {goal.completed_at && (
                        <p className="text-xs text-emerald-600">
                          ✓ Completed {format(new Date(goal.completed_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteGoal(goal.id)}
                      aria-label="Delete goal"
                      className="shrink-0 mt-0.5 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
