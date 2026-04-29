'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Target, Plus, Check, Trash2, Loader2, AlertCircle,
  Dumbbell, Wallet, BookOpen, Sparkles,
  ChevronDown, ChevronUp, CalendarDays, CalendarRange, TrendingUp,
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

type Category  = 'fitness' | 'finance' | 'books' | 'general'
type Timeframe = 'week' | 'month' | 'year' | 'custom'

interface Goal {
  id: string
  title: string
  description: string | null
  category: Category
  timeframe: Timeframe
  target_date: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

const CATEGORY_CONFIG: Record<Category, { label: string; icon: typeof Target; color: string; bg: string; border: string }> = {
  fitness: { label: 'Fitness', icon: Dumbbell,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  finance: { label: 'Finance', icon: Wallet,    color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20'     },
  books:   { label: 'Books',   icon: BookOpen,  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
  general: { label: 'General', icon: Sparkles,  color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20'  },
}

const TIMEFRAME_CONFIG: Record<Timeframe, {
  label: string; icon: typeof Target
  sectionBg: string; sectionBorder: string; accentColor: string; badgeBg: string; badgeText: string
}> = {
  week:   {
    label: 'This Week', icon: CalendarDays,
    sectionBg: 'bg-cyan-500/5', sectionBorder: 'border-cyan-500/30',
    accentColor: 'text-cyan-400', badgeBg: 'bg-cyan-500/15', badgeText: 'text-cyan-300',
  },
  month:  {
    label: 'This Month', icon: CalendarRange,
    sectionBg: 'bg-amber-500/5', sectionBorder: 'border-amber-500/30',
    accentColor: 'text-amber-400', badgeBg: 'bg-amber-500/15', badgeText: 'text-amber-300',
  },
  year:   {
    label: 'This Year', icon: TrendingUp,
    sectionBg: 'bg-violet-500/5', sectionBorder: 'border-violet-500/30',
    accentColor: 'text-violet-400', badgeBg: 'bg-violet-500/15', badgeText: 'text-violet-300',
  },
  custom: {
    label: 'Other Goals', icon: Target,
    sectionBg: 'bg-white/3', sectionBorder: 'border-white/8',
    accentColor: 'text-slate-400', badgeBg: 'bg-white/8', badgeText: 'text-slate-400',
  },
}

function todayStr() { return new Date().toISOString().split('T')[0] }

// Derive which timeframe bucket a goal belongs to:
// - If target_date falls within this week → 'week'
// - If target_date falls within this month (excl. this week) → 'month'
// - If target_date falls within this year (excl. this month) → 'year'
// - Otherwise fall back to the stored timeframe column
function effectiveTimeframe(goal: Goal): Timeframe {
  if (!goal.target_date) return goal.timeframe

  const date = parseISO(goal.target_date)
  const now  = new Date()

  // Week: Monday–Sunday of current week
  const weekStart = new Date(now)
  const dow = weekStart.getDay() || 7        // Mon=1 … Sun=7
  weekStart.setDate(weekStart.getDate() - (dow - 1))
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  if (date >= weekStart && date <= weekEnd) return 'week'

  // Month: 1st–last day of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  if (date >= monthStart && date <= monthEnd) return 'month'

  // Year: Jan 1–Dec 31 of current year
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd   = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)

  if (date >= yearStart && date <= yearEnd) return 'year'

  return goal.timeframe
}

function DateStatus({ targetDate }: { targetDate: string }) {
  const date = parseISO(targetDate)
  const days = differenceInDays(date, new Date())
  const formatted = format(date, 'MMM d, yyyy')
  if (isPast(date) && days < 0) return <span className="text-xs text-red-400">{formatted} · {Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="text-xs text-amber-400">{formatted} · Due today</span>
  if (days <= 7)  return <span className="text-xs text-amber-400">{formatted} · {days}d left</span>
  if (days <= 30) return <span className="text-xs text-slate-400">{formatted} · {days}d left</span>
  return <span className="text-xs text-slate-500">{formatted}</span>
}

// ─── Add Goal Modal ───────────────────────────────────────────

function AddGoalModal({
  onAdd,
  defaultTimeframe = 'custom',
  trigger,
}: {
  onAdd: () => void
  defaultTimeframe?: Timeframe
  trigger?: React.ReactNode
}) {
  const [open, setOpen]             = useState(false)
  const [title, setTitle]           = useState('')
  const [description, setDesc]      = useState('')
  const [category, setCategory]     = useState<Category>('general')
  const [timeframe, setTimeframe]   = useState<Timeframe>(defaultTimeframe)
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Reset timeframe to defaultTimeframe when modal opens
  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v) setTimeframe(defaultTimeframe)
    if (!v) setError(null)
  }

  async function handleAdd() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Not signed in. Please refresh.'); setSaving(false); return }

    const { error: err } = await supabase.from('user_goals').insert({
      user_id:     session.user.id,
      title:       title.trim(),
      description: description.trim() || null,
      category,
      timeframe,
      target_date: timeframe === 'custom' ? (targetDate || null) : null,
    })
    if (err) { setError(err.message); setSaving(false); return }

    setTitle(''); setDesc(''); setCategory('general')
    setTimeframe(defaultTimeframe); setTargetDate('')
    setSaving(false); setOpen(false); onAdd()
  }

  const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
    { value: 'week',   label: '🗓 This Week'  },
    { value: 'month',  label: '📅 This Month' },
    { value: 'year',   label: '📈 This Year'  },
    { value: 'custom', label: '📌 Custom'     },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
            <Plus className="h-4 w-4" /> Add Goal
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Goal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timeframe */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Timeframe</Label>
            <div className="grid grid-cols-4 gap-2">
              {TIMEFRAME_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTimeframe(value)}
                  className={cn(
                    'rounded-lg border py-2 px-1 text-xs font-medium transition-all text-center',
                    timeframe === value
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Goal</Label>
            <Input
              autoFocus
              placeholder={
                timeframe === 'week'  ? 'e.g. Complete 3 workouts' :
                timeframe === 'month' ? 'e.g. Read 2 books' :
                timeframe === 'year'  ? 'e.g. Run a half marathon' :
                'e.g. Learn a new skill'
              }
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>

          {/* Category */}
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

          {/* Target date — only for custom */}
          {timeframe === 'custom' && (
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
          )}

          {/* Description */}
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

// ─── Goal card ────────────────────────────────────────────────

function GoalCard({
  goal,
  onComplete,
  onDelete,
  markingId,
  deletingId,
}: {
  goal: Goal
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  markingId: string | null
  deletingId: string | null
}) {
  const cat = CATEGORY_CONFIG[goal.category]
  const CatIcon = cat.icon

  return (
    <div className={cn(
      'group flex items-start gap-3 rounded-xl border p-4 transition-all',
      'border-white/10 bg-white/3 hover:border-white/20',
    )}>
      <button
        type="button"
        onClick={() => onComplete(goal.id)}
        disabled={!!markingId}
        aria-label="Mark complete"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white/30 hover:border-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
      >
        {markingId === goal.id
          ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          : <Check className="h-3 w-3 text-white opacity-0 group-hover:opacity-60" />
        }
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start gap-2 justify-between">
          <p className="text-sm font-medium text-white leading-snug">{goal.title}</p>
          <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full shrink-0 border', cat.bg, cat.color, cat.border)}>
            <CatIcon className="h-3 w-3" />
            {cat.label}
          </span>
        </div>
        {goal.description && (
          <p className="text-xs text-slate-400 leading-relaxed">{goal.description}</p>
        )}
        {goal.target_date && <DateStatus targetDate={goal.target_date} />}
      </div>

      <button
        type="button"
        onClick={() => onDelete(goal.id)}
        disabled={deletingId === goal.id}
        aria-label="Delete goal"
        className="shrink-0 mt-0.5 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
      >
        {deletingId === goal.id
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────

function GoalSection({
  timeframe,
  goals,
  onAdd,
  onComplete,
  onDelete,
  markingId,
  deletingId,
}: {
  timeframe: Timeframe
  goals: Goal[]
  onAdd: () => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  markingId: string | null
  deletingId: string | null
}) {
  const [collapsed, setCollapsed] = useState(false)
  const cfg  = TIMEFRAME_CONFIG[timeframe]
  const Icon = cfg.icon

  return (
    <div className={cn('rounded-xl border transition-all', cfg.sectionBg, cfg.sectionBorder)}>
      {/* Section header — click anywhere to toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', cfg.accentColor)} />
          <span className={cn('text-sm font-semibold', cfg.accentColor)}>{cfg.label}</span>
          {goals.length > 0 && (
            <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', cfg.badgeBg, cfg.badgeText)}>
              {goals.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Add button — stop propagation so it doesn't collapse the section */}
          <AddGoalModal
            onAdd={onAdd}
            defaultTimeframe={timeframe}
            trigger={
              <span
                role="button"
                onClick={e => e.stopPropagation()}
                className={cn(
                  'flex items-center gap-1 text-xs font-medium transition-colors',
                  cfg.accentColor, 'opacity-70 hover:opacity-100'
                )}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </span>
            }
          />
          {collapsed
            ? <ChevronDown className={cn('h-3.5 w-3.5', cfg.accentColor, 'opacity-60')} />
            : <ChevronUp   className={cn('h-3.5 w-3.5', cfg.accentColor, 'opacity-60')} />
          }
        </div>
      </button>

      {/* Goals — hidden when collapsed */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {goals.length > 0 ? (
            goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onComplete={onComplete}
                onDelete={onDelete}
                markingId={markingId}
                deletingId={deletingId}
              />
            ))
          ) : (
            <p className="text-xs text-slate-600 py-1">
              No {cfg.label.toLowerCase()} goals yet — hit Add to set one.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Category section (By Category tab) ──────────────────────

function CategorySection({
  category,
  goals,
  onAdd,
  onComplete,
  onDelete,
  markingId,
  deletingId,
}: {
  category: Category
  goals: Goal[]
  onAdd: () => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  markingId: string | null
  deletingId: string | null
}) {
  const cfg  = CATEGORY_CONFIG[category]
  const Icon = cfg.icon

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', cfg.bg, cfg.border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', cfg.color)} />
          <span className={cn('text-sm font-semibold', cfg.color)}>{cfg.label}</span>
          {goals.length > 0 && (
            <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', cfg.bg, cfg.color)}>
              {goals.length}
            </span>
          )}
        </div>
        <AddGoalModal
          onAdd={onAdd}
          defaultTimeframe="custom"
          trigger={
            <button
              type="button"
              className={cn('flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-colors', cfg.color)}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          }
        />
      </div>

      {goals.length > 0 ? (
        <div className="space-y-2">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onComplete={onComplete}
              onDelete={onDelete}
              markingId={markingId}
              deletingId={deletingId}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600 py-1">
          No {cfg.label.toLowerCase()} goals yet — hit Add to set one.
        </p>
      )}
    </div>
  )
}

// ─── Completed list (shared) ──────────────────────────────────

function CompletedList({ goals, onDelete }: { goals: Goal[]; onDelete: (id: string) => void }) {
  const [show, setShow] = useState(false)
  if (!goals.length) return null
  return (
    <div className="space-y-2 pt-2 border-t border-white/5">
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors"
      >
        {show ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Completed ({goals.length})
      </button>
      {show && (
        <div className="space-y-2">
          {goals.map(goal => {
            const cfg  = CATEGORY_CONFIG[goal.category]
            const Icon = cfg.icon
            return (
              <div key={goal.id} className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/3 p-4 opacity-60">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/30 border-2 border-emerald-500">
                  <Check className="h-3 w-3 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start gap-2 justify-between">
                    <p className="text-sm font-medium text-slate-400 line-through leading-snug">{goal.title}</p>
                    <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full shrink-0', cfg.bg, cfg.color)}>
                      <Icon className="h-3 w-3" />{cfg.label}
                    </span>
                  </div>
                  {goal.completed_at && (
                    <p className="text-xs text-emerald-600">✓ Completed {format(new Date(goal.completed_at), 'MMM d, yyyy')}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(goal.id)}
                  aria-label="Delete"
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
  )
}

// ─── Main component ───────────────────────────────────────────

type TabView = 'timeframe' | 'category'

export default function GoalsList() {
  const [goals, setGoals]               = useState<Goal[]>([])
  const [loading, setLoading]           = useState(true)
  const [markingId, setMarkingId]       = useState<string | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [tab, setTab]                   = useState<TabView>('timeframe')
  const [activeCategory, setActiveCat]  = useState<Category>('fitness')

  const fetchGoals = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const { data } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_completed', { ascending: true })
      .order('created_at', { ascending: false })
    setGoals((data as Goal[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  async function markComplete(id: string) {
    setMarkingId(id)
    const now = new Date().toISOString()
    setGoals(prev => prev.map(g => g.id === id ? { ...g, is_completed: true, completed_at: now } : g))
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_goals')
      .update({ is_completed: true, completed_at: now, updated_at: now })
      .eq('id', id)
    setMarkingId(null)
  }

  async function deleteGoal(id: string) {
    setDeletingId(id)
    setGoals(prev => prev.filter(g => g.id !== id))
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_goals').delete().eq('id', id)
    setDeletingId(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  const active    = goals.filter(g => !g.is_completed)
  const completed = goals.filter(g => g.is_completed)

  const byTimeframe = (tf: Timeframe) => active.filter(g => effectiveTimeframe(g) === tf)
  const byCategory  = (cat: Category) => active.filter(g => g.category === cat)

  const weekGoals   = byTimeframe('week')
  const monthGoals  = byTimeframe('month')
  const yearGoals   = byTimeframe('year')
  const customGoals = byTimeframe('custom')

  const TABS: { value: TabView; label: string }[] = [
    { value: 'timeframe', label: 'By Timeframe' },
    { value: 'category',  label: 'By Category'  },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {active.length} active goal{active.length !== 1 ? 's' : ''}
          {completed.length > 0 && ` · ${completed.length} completed`}
        </p>
        <AddGoalModal onAdd={fetchGoals} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/3 p-1">
        {TABS.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-xs font-medium transition-all',
              tab === t.value
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── By Timeframe tab ── */}
      {tab === 'timeframe' && (
        <div className="space-y-4">
          <GoalSection timeframe="week"   goals={weekGoals}   onAdd={fetchGoals} onComplete={markComplete} onDelete={deleteGoal} markingId={markingId} deletingId={deletingId} />
          <GoalSection timeframe="month"  goals={monthGoals}  onAdd={fetchGoals} onComplete={markComplete} onDelete={deleteGoal} markingId={markingId} deletingId={deletingId} />
          <GoalSection timeframe="year"   goals={yearGoals}   onAdd={fetchGoals} onComplete={markComplete} onDelete={deleteGoal} markingId={markingId} deletingId={deletingId} />
          {customGoals.length > 0 && (
            <GoalSection timeframe="custom" goals={customGoals} onAdd={fetchGoals} onComplete={markComplete} onDelete={deleteGoal} markingId={markingId} deletingId={deletingId} />
          )}
          {active.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
              <Target className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No active goals yet.</p>
              <p className="text-slate-600 text-xs mt-1">Add a weekly, monthly, or yearly goal above.</p>
            </div>
          )}
          <CompletedList goals={completed} onDelete={deleteGoal} />
        </div>
      )}

      {/* ── By Category tab ── */}
      {tab === 'category' && (
        <div className="space-y-4">
          {/* Category sub-tabs */}
          <div className="flex gap-1 rounded-lg border border-white/10 bg-white/3 p-1">
            {(['fitness', 'finance', 'books', 'general'] as Category[]).map(cat => {
              const cfg  = CATEGORY_CONFIG[cat]
              const Icon = cfg.icon
              const count = byCategory(cat).length
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCat(cat)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all',
                    activeCategory === cat
                      ? cn('text-white shadow', cfg.bg, cfg.border, 'border')
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', activeCategory === cat ? cfg.color : '')} />
                  <span className="hidden sm:inline">{cfg.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      'rounded-full px-1 text-[10px] font-bold leading-4',
                      activeCategory === cat ? cn(cfg.bg, cfg.color) : 'bg-white/10 text-slate-400'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Active category content */}
          <CategorySection
            category={activeCategory}
            goals={byCategory(activeCategory)}
            onAdd={fetchGoals}
            onComplete={markComplete}
            onDelete={deleteGoal}
            markingId={markingId}
            deletingId={deletingId}
          />

          <CompletedList goals={completed} onDelete={deleteGoal} />
        </div>
      )}
    </div>
  )
}
