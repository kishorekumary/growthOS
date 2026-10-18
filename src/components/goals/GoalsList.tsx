'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Target, Plus, Check, Trash2, Loader2, AlertCircle,
  Dumbbell, Wallet, BookOpen, Sparkles, Briefcase,
  ChevronDown, ChevronUp, CalendarDays, CalendarRange, TrendingUp, Pencil, RotateCcw,
  Image as ImageIcon, Maximize2, Trophy,
} from 'lucide-react'
import GoalsFocusModal from './GoalsFocusModal'
import GoalsOverview from './GoalsOverview'
import EmptyState from '@/components/ui/empty-state'
import { Skeleton, SkeletonCards } from '@/components/ui/skeleton'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { timeProgress, type Urgency } from '@/lib/goalProgress'
import { formatDistanceToNowStrict } from 'date-fns'
import { useSettle } from '@/hooks/useSettle'
import { haptic } from '@/lib/effects'
import Collapse from '@/components/ui/collapse'
import ListClearedBurst from '@/components/shared/ListClearedBurst'

type Category  = 'fitness' | 'finance' | 'books' | 'general' | 'career'
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
  vision_image_url: string | null
}

// `accent` is a gradient for the card stripe and the on-track time bar.
const CATEGORY_CONFIG: Record<Category, { label: string; icon: typeof Target; color: string; bg: string; border: string; accent: string }> = {
  fitness: { label: 'Fitness', icon: Dumbbell,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accent: 'from-emerald-400 to-teal-500'  },
  finance: { label: 'Finance', icon: Wallet,    color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     accent: 'from-sky-400 to-blue-500'      },
  books:   { label: 'Books',   icon: BookOpen,  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   accent: 'from-amber-300 to-orange-500'  },
  general: { label: 'Personal', icon: Sparkles,   color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', accent: 'from-violet-400 to-fuchsia-500' },
  career:  { label: 'Career',  icon: Briefcase,  color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   accent: 'from-rose-400 to-pink-500'     },
}

// Card actions: revealed on hover with a mouse, always visible on touch
// screens (which have no hover to reveal them).
const CARD_ACTION = 'flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white/8 hover:text-white transition-all'
const REVEAL = 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100'

const TIMEFRAME_CONFIG: Record<Timeframe, {
  label: string; icon: typeof Target
  sectionBg: string; sectionBorder: string; accentColor: string; badgeBg: string; badgeText: string
}> = {
  week:   {
    label: 'This Week', icon: CalendarDays,
    sectionBg: 'bg-gradient-to-b from-cyan-500/10 to-cyan-500/[0.02]', sectionBorder: 'border-cyan-500/20',
    accentColor: 'text-cyan-400', badgeBg: 'bg-cyan-500/15', badgeText: 'text-cyan-300',
  },
  month:  {
    label: 'This Month', icon: CalendarRange,
    sectionBg: 'bg-gradient-to-b from-amber-500/10 to-amber-500/[0.02]', sectionBorder: 'border-amber-500/20',
    accentColor: 'text-amber-400', badgeBg: 'bg-amber-500/15', badgeText: 'text-amber-300',
  },
  year:   {
    label: 'This Year', icon: TrendingUp,
    sectionBg: 'bg-gradient-to-b from-violet-500/10 to-violet-500/[0.02]', sectionBorder: 'border-violet-500/20',
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

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-red-400', today: 'text-amber-300', soon: 'text-amber-300', ok: 'text-slate-400', none: 'text-slate-500',
}

// Due date plus how much of the goal's time has gone by, coloured calm →
// amber (a week or less) → red (overdue).
function GoalTimeline({ goal, accent }: { goal: Goal; accent: string }) {
  if (!goal.target_date) return null
  const { elapsed, daysLeft, urgency } = timeProgress(goal.created_at, goal.target_date)
  const date = format(parseISO(goal.target_date), 'MMM d, yyyy')
  const n = Math.abs(daysLeft ?? 0)
  const status =
    urgency === 'overdue' ? `${n} day${n === 1 ? '' : 's'} overdue`
    : urgency === 'today' ? 'Due today'
    : `${n} day${n === 1 ? '' : 's'} left`
  return (
    <div className="pt-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-[width] duration-700',
            urgency === 'overdue' ? 'from-red-500 to-rose-400' : urgency === 'ok' ? accent : 'from-amber-400 to-orange-400',
          )}
          style={{ width: `${Math.max(3, elapsed * 100)}%` }}
        />
      </div>
      <p className={cn('mt-1.5 flex items-center justify-between gap-2 text-[11px]', URGENCY_TEXT[urgency])}>
        <span>{date}</span>
        <span className="font-medium">{status}</span>
      </p>
    </div>
  )
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
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-snow gap-1.5">
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
            className="w-full bg-violet-600 hover:bg-violet-700 text-snow"
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

// ─── Edit Goal Modal ──────────────────────────────────────────

function EditGoalModal({
  goal,
  onSave,
  trigger,
}: {
  goal: Goal
  onSave: () => void
  trigger?: React.ReactNode
}) {
  const [open, setOpen]             = useState(false)
  const [title, setTitle]           = useState('')
  const [description, setDesc]      = useState('')
  const [category, setCategory]     = useState<Category>('general')
  const [timeframe, setTimeframe]   = useState<Timeframe>('custom')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v) {
      setTitle(goal.title)
      setDesc(goal.description ?? '')
      setCategory(goal.category)
      setTimeframe(goal.timeframe)
      setTargetDate(goal.target_date ?? '')
      setError(null)
    }
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const now = new Date().toISOString()
    const { error: err } = await supabase.from('user_goals').update({
      title:       title.trim(),
      description: description.trim() || null,
      category,
      timeframe,
      target_date: timeframe === 'custom' ? (targetDate || null) : null,
      updated_at:  now,
    }).eq('id', goal.id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    setOpen(false)
    onSave()
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
          <button type="button" className="text-slate-600 hover:text-slate-400 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="space-y-1.5">
            <Label className="text-slate-300">Goal</Label>
            <Input
              autoFocus
              placeholder="Goal title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
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

          {timeframe === 'custom' && (
            <div className="space-y-1.5">
              <Label className="text-slate-300">Target date (optional)</Label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}

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
            className="w-full bg-violet-600 hover:bg-violet-700 text-snow"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Goal Vision Modal ────────────────────────────────────────

function GoalVisionModal({ goal, onImageSaved }: { goal: Goal; onImageSaved: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [activeStyle, setActiveStyle] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(goal.vision_image_url)

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v) {
      setDescription('')
      setPreviewUrl(goal.vision_image_url)
      setError(null)
    }
  }

  const STYLES = [
    { label: '📸 Realistic',   suffix: 'ultra-realistic photography, 4K, natural lighting, highly detailed' },
    { label: '🎨 Artistic',    suffix: 'vibrant digital painting, detailed illustration, concept art' },
    { label: '🎬 Cinematic',   suffix: 'cinematic scene, dramatic golden hour lighting, epic composition, movie still' },
    { label: '✨ Aspirational', suffix: 'luxury lifestyle, aspirational, polished, magazine cover quality' },
  ]

  // The description field is optional — if blank, fall back to the goal title
  const effectivePrompt = description.trim() || goal.title

  async function generate() {
    setGenerating(true)
    setError(null)
    const fullPrompt = `${effectivePrompt}, ${STYLES[activeStyle].suffix}`
    try {
      const res = await fetch('/api/ai/goal-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: goal.id, prompt: fullPrompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.imageUrl) {
        setPreviewUrl(data.imageUrl)
        onImageSaved(data.imageUrl)
      } else {
        setError(data.error ?? 'Failed to generate image. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setGenerating(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Visualize goal"
          aria-label="Visualize goal"
          className={cn(CARD_ACTION, 'hover:text-violet-300')}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Visualize: {goal.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Goal vision" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <ImageIcon className="h-10 w-10" />
                <p className="text-xs">Your vision will appear here</p>
              </div>
            )}
            {generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/75 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <p className="text-xs text-slate-300">Generating your vision… (~20s)</p>
              </div>
            )}
          </div>

          {/* Description — optional, falls back to goal title */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">
              Visual description
              <span className="ml-1.5 text-slate-600 font-normal">(optional — leave blank to use goal title)</span>
            </Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder={`e.g. "A spacious modern family home with large windows, a lush green garden, warm evening light — the kind of home that feels like a true sanctuary"`}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-[11px] text-slate-600">
              The more specific and visual your description, the better the result. Describe the scene, mood, and details you want to see.
            </p>
          </div>

          {/* Style chips */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Style</Label>
            <div className="flex gap-2 flex-wrap">
              {STYLES.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setActiveStyle(i)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    activeStyle === i
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">{error}</p>
          )}

          <Button
            onClick={generate}
            disabled={generating}
            className="w-full bg-violet-600 hover:bg-violet-700 text-snow gap-2"
          >
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              : <><Sparkles className="h-4 w-4" /> {previewUrl ? 'Regenerate' : 'Generate Vision'}</>
            }
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
  onEdit,
  onImageSaved,
  markingId,
  deletingId,
}: {
  goal: Goal
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: () => void
  onImageSaved: (id: string, url: string) => void
  markingId: string | null
  deletingId: string | null
}) {
  const cat = CATEGORY_CONFIG[goal.category]
  const CatIcon = cat.icon
  // Just achieved: shown checked for a moment before the card glides out.
  const achieved = goal.is_completed

  return (
    <div className="card-sheen group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] transition-colors hover:border-white/20">
      <div aria-hidden className={cn('absolute inset-y-0 left-0 w-1 bg-gradient-to-b', cat.accent)} />

      {goal.vision_image_url && (
        <div className="relative h-36 w-full overflow-hidden">
          <img src={goal.vision_image_url} alt="Goal vision" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80" />
        </div>
      )}

      <div className="flex items-start gap-3 py-4 pl-5 pr-3">
        <button
          type="button"
          onClick={() => onComplete(goal.id)}
          disabled={!!markingId || achieved}
          aria-label="Mark achieved"
          title="Mark achieved"
          className={cn(
            'group/check mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90',
            achieved
              ? 'animate-pop border-emerald-400 bg-emerald-500 motion-reduce:animate-none'
              : 'border-white/25 hover:border-emerald-400 hover:bg-emerald-500/20',
          )}
        >
          {achieved
            ? <Check className="h-4 w-4 text-emerald-950" strokeWidth={3} />
            : markingId === goal.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              : <Check className="h-3.5 w-3.5 text-emerald-300 opacity-0 transition-opacity group-hover/check:opacity-100 [@media(hover:none)]:opacity-30" strokeWidth={3} />
          }
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start gap-2">
            <p className={cn('min-w-0 flex-1 text-sm font-semibold leading-snug', achieved ? 'text-emerald-200 line-through decoration-emerald-400/60' : 'text-white')}>{goal.title}</p>
            <div className={cn('-mr-1 -mt-1 flex shrink-0 items-center transition-opacity', REVEAL)}>
              <EditGoalModal
                goal={goal}
                onSave={onEdit}
                trigger={
                  <button type="button" className={CARD_ACTION} aria-label="Edit goal" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <GoalVisionModal goal={goal} onImageSaved={url => onImageSaved(goal.id, url)} />
              <button
                type="button"
                onClick={() => onDelete(goal.id)}
                disabled={deletingId === goal.id}
                aria-label="Delete goal"
                title="Delete"
                className={cn(CARD_ACTION, 'hover:bg-red-500/10 hover:text-red-400')}
              >
                {deletingId === goal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {goal.description && (
            <p className="text-xs leading-relaxed text-slate-400">{goal.description}</p>
          )}
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]', cat.bg, cat.color, cat.border)}>
            <CatIcon className="h-3 w-3" />
            {cat.label}
          </span>
          <GoalTimeline goal={goal} accent={cat.accent} />
        </div>
      </div>
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
  onEdit,
  onImageSaved,
  markingId,
  deletingId,
  leaving,
}: {
  timeframe: Timeframe
  goals: Goal[]
  onAdd: () => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: () => void
  onImageSaved: (id: string, url: string) => void
  markingId: string | null
  deletingId: string | null
  leaving: ReadonlySet<string>  // just achieved: collapsing out
}) {
  const [collapsed, setCollapsed] = useState(false)
  const cfg  = TIMEFRAME_CONFIG[timeframe]
  const Icon = cfg.icon

  return (
    <div className={cn('rounded-2xl border transition-all', cfg.sectionBg, cfg.sectionBorder)}>
      {/* Section header — click anywhere to toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', cfg.badgeBg)}>
            <Icon className={cn('h-3.5 w-3.5', cfg.accentColor)} />
          </span>
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
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  cfg.badgeBg, cfg.badgeText, 'hover:brightness-125'
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
              <Collapse key={goal.id} open={!leaving.has(goal.id)}>
                <GoalCard
                  goal={goal}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onImageSaved={onImageSaved}
                  markingId={markingId}
                  deletingId={deletingId}
                />
              </Collapse>
            ))
          ) : (
            <p className="text-xs text-slate-600 py-1">
              Nothing set for {cfg.label.toLowerCase()} yet — add a goal to get started.
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
  onEdit,
  onImageSaved,
  markingId,
  deletingId,
  leaving,
}: {
  category: Category
  goals: Goal[]
  onAdd: () => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: () => void
  onImageSaved: (id: string, url: string) => void
  markingId: string | null
  deletingId: string | null
  leaving: ReadonlySet<string>  // just achieved: collapsing out
}) {
  const cfg  = CATEGORY_CONFIG[category]
  const Icon = cfg.icon

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', cfg.bg, cfg.border)}>
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
              className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium hover:brightness-125 transition-colors', cfg.bg, cfg.color)}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          }
        />
      </div>

      {goals.length > 0 ? (
        <div className="space-y-2">
          {goals.map(goal => (
            <Collapse key={goal.id} open={!leaving.has(goal.id)}>
              <GoalCard
                goal={goal}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
                onImageSaved={onImageSaved}
                markingId={markingId}
                deletingId={deletingId}
              />
            </Collapse>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600 py-1">
          Nothing here yet — add a goal to get started.
        </p>
      )}
    </div>
  )
}

// ─── Completed list (shared) ──────────────────────────────────

function CompletedList({
  goals,
  onDelete,
  onUncomplete,
}: {
  goals: Goal[]
  onDelete: (id: string) => void
  onUncomplete: (id: string) => void
}) {
  const [show, setShow] = useState(false)
  if (!goals.length) return null
  const latest = [...goals]
    .filter(g => g.completed_at)
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))[0]
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15">
          <Trophy className="h-4 w-4 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-200">Achieved <span className="text-emerald-400/70">· {goals.length}</span></p>
          {!show && latest && (
            <p className="truncate text-[11px] text-slate-500">
              Latest: {latest.title} · {formatDistanceToNowStrict(new Date(latest.completed_at!), { addSuffix: true })}
            </p>
          )}
        </div>
        {show ? <ChevronUp className="h-4 w-4 text-emerald-400/60" /> : <ChevronDown className="h-4 w-4 text-emerald-400/60" />}
      </button>
      {show && (
        <div className="space-y-2 px-4 pb-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {goals.map(goal => {
            const cfg  = CATEGORY_CONFIG[goal.category]
            const Icon = cfg.icon
            return (
              <div key={goal.id} className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                <span className="text-lg" aria-hidden>🏆</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{goal.title}</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Icon className={cn('h-3 w-3', cfg.color)} />
                    {cfg.label}
                    {goal.completed_at && <> · {format(new Date(goal.completed_at), 'MMM d, yyyy')}</>}
                  </p>
                </div>
                <div className={cn('flex shrink-0 items-center transition-opacity', REVEAL)}>
                  <button
                    type="button"
                    onClick={() => onUncomplete(goal.id)}
                    title="Back to in progress"
                    aria-label="Back to in progress"
                    className={CARD_ACTION}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(goal.id)}
                    title="Delete"
                    aria-label="Delete"
                    className={cn(CARD_ACTION, 'hover:bg-red-500/10 hover:text-red-400')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
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
  const { data: goals, loading, isOffline, refetch: fetchGoals, setData: setGoals } = useCachedQuery<Goal[]>(
    'goals:all',
    (supabase, userId) => supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .order('is_completed', { ascending: true })
      .order('created_at', { ascending: false }),
    [],
    []
  )
  const [markingId, setMarkingId]       = useState<string | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [tab, setTab]                   = useState<TabView>('timeframe')
  const [activeCategory, setActiveCat]  = useState<Category>('fitness')
  const [focusOpen, setFocusOpen]       = useState(false)
  // A goal just achieved stays in place, checked, then glides out to the
  // Achieved shelf while the celebration plays.
  const settle = useSettle(900)
  const [celebrating, setCelebrating]   = useState<Goal | null>(null)
  useEffect(() => {
    if (!celebrating) return
    const t = setTimeout(() => setCelebrating(null), 2200)
    return () => clearTimeout(t)
  }, [celebrating])

  async function markComplete(id: string) {
    setMarkingId(id)
    const now = new Date().toISOString()
    settle.hold(id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, is_completed: true, completed_at: now } : g))
    setCelebrating(goals.find(g => g.id === id) ?? null)
    haptic('success')
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_goals')
      .update({ is_completed: true, completed_at: now, updated_at: now })
      .eq('id', id)
    settle.release(id)
    setMarkingId(null)
  }

  async function markUncomplete(id: string) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, is_completed: false, completed_at: null } : g))
    const supabase = createSupabaseBrowserClient()
    const now = new Date().toISOString()
    await supabase.from('user_goals')
      .update({ is_completed: false, completed_at: null, updated_at: now })
      .eq('id', id)
  }

  async function deleteGoal(id: string) {
    setDeletingId(id)
    setGoals(prev => prev.filter(g => g.id !== id))
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_goals').delete().eq('id', id)
    setDeletingId(null)
  }

  function handleImageSaved(id: string, url: string) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, vision_image_url: url } : g))
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <SkeletonCards count={3} />
    </div>
  )

  const active    = goals.filter(g => !g.is_completed || settle.held.has(g.id))
  const completed = goals.filter(g => g.is_completed && !settle.held.has(g.id))

  const byTimeframe = (tf: Timeframe) => active.filter(g => effectiveTimeframe(g) === tf)
  const byCategory  = (cat: Category) => active.filter(g => g.category === cat)

  const weekGoals   = byTimeframe('week')
  const monthGoals  = byTimeframe('month')
  const yearGoals   = byTimeframe('year')
  const customGoals = byTimeframe('custom')

  const TABS: { value: TabView; label: string }[] = [
    { value: 'timeframe', label: 'Timeline' },
    { value: 'category',  label: 'Category' },
  ]

  return (
    <div className="space-y-4">
      {celebrating && typeof document !== 'undefined' && createPortal(
        <ListClearedBurst title="Goal achieved!" subtitle={celebrating.title} emoji="🏆" />,
        document.body,
      )}

      {goals.length > 0 && <GoalsOverview goals={goals} />}

      {/* Header (the empty state has its own Add button) */}
      {goals.length > 0 && <>
      <div className="flex items-center gap-2">
        {/* Timeline / Category switch with a sliding highlight */}
        <div className="relative flex flex-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <div
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.7)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${tab === 'timeframe' ? 0 : 100}%)` }}
          />
          {TABS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                'relative flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                tab === t.value ? 'text-snow' : 'text-slate-400 hover:text-white',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {active.length > 0 && (
          <button
            onClick={() => setFocusOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 hover:text-violet-300 transition-colors"
            aria-label="Focus mode"
            title="Focus mode"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
        <AddGoalModal onAdd={fetchGoals} />
      </div>

      <GoalsFocusModal
        goals={active}
        title="Active Goals"
        open={focusOpen}
        onClose={() => setFocusOpen(false)}
      />
      </>}

      {goals.length === 0 && isOffline && (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Target className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Can&apos;t load — you&apos;re offline.</p>
        </div>
      )}
      {goals.length === 0 && !isOffline && (
        <EmptyState
          icon={Target}
          title="Your first goal starts here"
          hint="Something you can finish this week, a habit to build this month, or a dream for this year. E.g. run 5k, read 2 books, save ₹50,000."
        >
          <AddGoalModal onAdd={fetchGoals} />
        </EmptyState>
      )}

      {/* ── By Timeframe tab ── */}
      {goals.length > 0 && tab === 'timeframe' && (
        <div className="space-y-4">
          <GoalSection timeframe="week"   goals={weekGoals}   onAdd={fetchGoals} onComplete={markComplete} onDelete={deleteGoal} onEdit={fetchGoals} onImageSaved={handleImageSaved} markingId={markingId} deletingId={deletingId} leaving={settle.leaving} />
          <GoalSection timeframe="month"  goals={monthGoals}  onAdd={fetchGoals} onComplete={markComplete} onDelete={deleteGoal} onEdit={fetchGoals} onImageSaved={handleImageSaved} markingId={markingId} deletingId={deletingId} leaving={settle.leaving} />
          <GoalSection timeframe="year"   goals={yearGoals}   onAdd={fetchGoals} onComplete={markComplete} onDelete={deleteGoal} onEdit={fetchGoals} onImageSaved={handleImageSaved} markingId={markingId} deletingId={deletingId} leaving={settle.leaving} />
          {customGoals.length > 0 && (
            <GoalSection timeframe="custom" goals={customGoals} onAdd={fetchGoals} onComplete={markComplete} onDelete={deleteGoal} onEdit={fetchGoals} onImageSaved={handleImageSaved} markingId={markingId} deletingId={deletingId} leaving={settle.leaving} />
          )}
          {active.length === 0 && (
            <EmptyState
              icon={Target}
              tone="emerald"
              title="Every goal achieved. What's next?"
              hint="Set the next one while the momentum is on your side."
            >
              <AddGoalModal onAdd={fetchGoals} />
            </EmptyState>
          )}
          <CompletedList goals={completed} onDelete={deleteGoal} onUncomplete={markUncomplete} />
        </div>
      )}

      {/* ── By Category tab ── */}
      {goals.length > 0 && tab === 'category' && (
        <div className="space-y-4">
          {/* Category chips — scroll sideways on narrow screens */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['fitness', 'finance', 'books', 'general', 'career'] as Category[]).map(cat => {
              const cfg  = CATEGORY_CONFIG[cat]
              const Icon = cfg.icon
              const count = byCategory(cat).length
              const on = activeCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCat(cat)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95',
                    on ? cn(cfg.bg, cfg.border, 'text-white shadow') : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', on ? cfg.color : '')} />
                  {cfg.label}
                  {count > 0 && (
                    <span className={cn('rounded-full px-1.5 text-[10px] font-bold leading-4', on ? cn(cfg.bg, cfg.color) : 'bg-white/10 text-slate-400')}>
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
            onEdit={fetchGoals}
            onImageSaved={handleImageSaved}
            markingId={markingId}
            deletingId={deletingId}
            leaving={settle.leaving}
          />

          <CompletedList goals={completed.filter(g => g.category === activeCategory)} onDelete={deleteGoal} onUncomplete={markUncomplete} />
        </div>
      )}
    </div>
  )
}
