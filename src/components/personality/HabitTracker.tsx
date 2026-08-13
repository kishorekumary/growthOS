'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Flame, Plus, Trash2, Check, Loader2, AlertCircle,
  RotateCcw, XCircle, Trophy, Pencil, Crown, Globe, X,
  Settings2, Eye, EyeOff,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { HabitCategory, HABIT_CATEGORY_META } from '@/lib/habitCategories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { computeStreak, localDateStr, todayStr, yesterdayStr, isGraceActive } from '@/lib/habitStreak'
import { useHabitCelebration } from '@/hooks/useHabitCelebration'
import { completeHabit } from '@/lib/completeHabit'
import { useReward } from '@/contexts/RewardContext'
import { DAILY_POINTS, DAILY_POINTS_KEYSTONE } from '@/lib/rewardMilestones'

type Category  = HabitCategory
type Frequency = 'daily' | 'weekly'
type LogStatus = 'done' | 'missed' | 'pending'

interface Habit {
  id: string
  habit_name: string
  category: Category
  frequency: Frequency
  streak_count: number
  longest_streak: number
  last_done_at: string | null
  is_keystone: boolean
  is_global: boolean
  created_at: string
}

interface HabitLog {
  habit_id: string
  log_date: string   // YYYY-MM-DD
  // 'auto_missed' is the nightly cron's silent backfill for a habit the user
  // never touched — getStatus() normalizes it to 'missed' before it reaches
  // any other code path in this file (see getStatus below).
  status: 'done' | 'missed' | 'auto_missed'
}

interface KeystoneMark {
  habit_id: string
}

interface HiddenMark {
  habit_id: string
}

const CATEGORY_STYLES: Record<Category, { label: string; badge: string }> = Object.fromEntries(
  Object.entries(HABIT_CATEGORY_META).map(([key, meta]) => [key, { label: `${meta.emoji} ${meta.label}`, badge: meta.badge }])
) as Record<Category, { label: string; badge: string }>

const FREQUENCY_LABELS: Record<Frequency, string> = { daily: 'Daily', weekly: 'Weekly' }

function readTodayMissed(): string[] {
  try { return JSON.parse(localStorage.getItem(`habit_missed_${todayStr()}`) ?? '[]') } catch { return [] }
}
function writeTodayMissed(ids: string[]) {
  try {
    const key = `habit_missed_${todayStr()}`
    if (ids.length) localStorage.setItem(key, JSON.stringify(ids))
    else localStorage.removeItem(key)
  } catch {}
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay() || 7    // Mon=1 … Sun=7
  d.setDate(d.getDate() - (day - 1))
  return localDateStr(d)
}

// Mon=1 … Sun=7 in local time
function daysElapsedThisWeek(): number {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}

// ─── Add Habit Modal ──────────────────────────────────────────

function AddHabitModal({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen]           = useState(false)
  const [name, setName]           = useState('')
  const [category, setCategory]   = useState<Category>('health')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user) {
      setError('Not signed in. Please refresh and try again.')
      setSaving(false)
      return
    }
    const { error: insertError } = await supabase
      .from('personality_habits')
      .insert({ user_id: session.user.id, habit_name: name.trim(), category, frequency })
    if (insertError) { setError(insertError.message); setSaving(false); return }
    setName(''); setCategory('health'); setFrequency('daily')
    setSaving(false); setOpen(false); onAdd()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
          <Plus className="h-4 w-4" /> Add Habit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Habit</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name" className="text-slate-300">Habit name</Label>
            <Input
              id="habit-name" autoFocus placeholder="e.g. Wake up at 5 AM"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(CATEGORY_STYLES) as [Category, typeof CATEGORY_STYLES[Category]][]).map(([key, val]) => (
                <button key={key} type="button" onClick={() => setCategory(key)}
                  className={cn('rounded-lg border py-2 px-3 text-xs font-medium transition-all',
                    category === key
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Frequency</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['daily', 'weekly'] as Frequency[]).map(f => (
                <button key={f} type="button" onClick={() => setFrequency(f)}
                  className={cn('rounded-lg border py-2.5 text-sm font-medium transition-all capitalize',
                    frequency === f
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleAdd} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Habit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Habit Modal ─────────────────────────────────────────

function EditHabitModal({ habit, onClose, onSave }: {
  habit: Habit
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName]           = useState(habit.habit_name)
  const [category, setCategory]   = useState<Category>(habit.category)
  const [frequency, setFrequency] = useState<Frequency>(habit.frequency)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: updateError } = await supabase
      .from('personality_habits')
      .update({ habit_name: name.trim(), category, frequency, updated_at: new Date().toISOString() })
      .eq('id', habit.id)
    if (updateError) { setError(updateError.message); setSaving(false); return }
    setSaving(false)
    onSave()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Habit</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-habit-name" className="text-slate-300">Habit name</Label>
            <Input
              id="edit-habit-name" autoFocus
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(CATEGORY_STYLES) as [Category, typeof CATEGORY_STYLES[Category]][]).map(([key, val]) => (
                <button key={key} type="button" onClick={() => setCategory(key)}
                  className={cn('rounded-lg border py-2 px-3 text-xs font-medium transition-all',
                    category === key
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Frequency</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['daily', 'weekly'] as Frequency[]).map(f => (
                <button key={f} type="button" onClick={() => setFrequency(f)}
                  className={cn('rounded-lg border py-2.5 text-sm font-medium transition-all capitalize',
                    frequency === f
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Habit Detail Modal ───────────────────────────────────────

function HabitDetailModal({ habit, onClose }: {
  habit: Habit
  onClose: () => void
}) {
  const ninetyDaysAgoStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 89)
    return localDateStr(d)
  }, [])

  const { data: logs, loading } = useCachedQuery<HabitLog[]>(
    `habit-logs:${habit.id}:90d`,
    (supabase, userId) => supabase
      .from('habit_logs')
      .select('habit_id, log_date, status')
      .eq('habit_id', habit.id)
      .eq('user_id', userId)
      .gte('log_date', ninetyDaysAgoStr),
    [],
    [habit.id]
  )

  const cat = CATEGORY_STYLES[habit.category] ?? CATEGORY_STYLES.health
  const today = todayStr()
  const createdAtStr = localDateStr(new Date(habit.created_at))

  const doneDates = useMemo(
    () => new Set(logs.filter(l => l.status === 'done').map(l => l.log_date)),
    [logs]
  )

  // Rolling 90-day window ending today — no "future" state (unlike the
  // challenge heatmap this mirrors), only done / not-done / before-creation.
  const days = useMemo(() => {
    const arr: { dateStr: string; isDone: boolean; beforeCreation: boolean; isToday: boolean }[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = localDateStr(d)
      arr.push({
        dateStr,
        isDone: doneDates.has(dateStr),
        beforeCreation: dateStr < createdAtStr,
        isToday: dateStr === today,
      })
    }
    return arr
  }, [doneDates, createdAtStr, today])

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{habit.habit_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', cat.badge)}>{cat.label}</span>
            <span className="text-xs text-slate-600">{FREQUENCY_LABELS[habit.frequency]}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/8 bg-white/3 p-3 text-center">
              <div className="text-lg font-bold text-orange-300">{habit.streak_count}</div>
              <div className="text-[10px] text-slate-500">current streak</div>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/3 p-3 text-center">
              <div className="text-lg font-bold text-amber-300">{habit.longest_streak}</div>
              <div className="text-[10px] text-slate-500">longest streak</div>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/3 p-3 text-center">
              <div className="text-lg font-bold text-emerald-300">{doneDates.size}</div>
              <div className="text-[10px] text-slate-500">done / 90d</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400">Last 90 days</p>
              <div className="flex items-center gap-3 text-[10px] text-slate-600">
                <span className="flex items-center gap-1"><span className={cn('w-2 h-2 rounded-sm inline-block', cat.badge)} />done</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/15 inline-block" />not done</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/[0.03] inline-block" />n/a</span>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
            ) : (
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
                {days.map(day => (
                  <div
                    key={day.dateStr}
                    title={day.dateStr}
                    className={cn(
                      'aspect-square rounded-sm',
                      day.beforeCreation ? 'bg-white/[0.03]' : day.isDone ? cat.badge : 'bg-red-500/15',
                      day.isToday && 'ring-1 ring-white/40'
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Manage Global Habits Modal ──────────────────────────────────

function ManageGlobalHabitsModal({
  globalHabits, hiddenIds, onHide, onUnhide,
}: {
  globalHabits: Habit[]
  hiddenIds: Set<string>
  onHide: (habitId: string) => Promise<void>
  onUnhide: (habitId: string) => Promise<void>
}) {
  const [open, setOpen]           = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function toggle(habit: Habit) {
    if (pendingId) return
    setPendingId(habit.id)
    try {
      if (hiddenIds.has(habit.id)) await onUnhide(habit.id)
      else await onHide(habit.id)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 gap-1.5">
          <Settings2 className="h-4 w-4" /> Manage Global
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Manage Global Habits</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">
          Hide habits you don&apos;t want to track. You can bring them back here anytime.
        </p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {globalHabits.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">No global habits yet.</p>
          )}
          {globalHabits.map(habit => {
            const hidden = hiddenIds.has(habit.id)
            return (
              <div key={habit.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                <span className={cn('text-sm truncate', hidden ? 'text-slate-500' : 'text-white')}>
                  {habit.habit_name}
                </span>
                <button
                  onClick={() => toggle(habit)}
                  disabled={pendingId !== null}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                    hidden
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-white/10 hover:bg-white/15 text-slate-300'
                  )}
                >
                  {pendingId === habit.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {hidden ? 'Restore' : 'Hide'}
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Weekly Score Card ────────────────────────────────────────

function WeeklyScoreCard({
  done, missed, weightedDone, weightedTotal, avgCompletedStreak,
}: {
  done: number; missed: number; weightedDone: number; weightedTotal: number; avgCompletedStreak: number
}) {
  const total = done + missed
  if (total === 0) return null

  // Base: weighted completion (0–80). Streak bonus: up to +20 for avg streak ≥ 10.
  const baseScore   = weightedTotal > 0 ? Math.round((weightedDone / weightedTotal) * 80) : 0
  const streakBonus = Math.min(20, Math.round(avgCompletedStreak * 2))
  const score       = Math.min(100, baseScore + streakBonus)

  const { label, color, bar } =
    score >= 90 ? { label: 'On fire! 🔥',         color: 'text-emerald-400', bar: 'bg-emerald-500' } :
    score >= 80 ? { label: 'Excellent week! 🎯',   color: 'text-emerald-400', bar: 'bg-emerald-500' } :
    score >= 60 ? { label: 'Good progress 💪',     color: 'text-sky-400',     bar: 'bg-sky-500'     } :
    score >= 40 ? { label: 'Keep going 📈',         color: 'text-amber-400',   bar: 'bg-amber-500'   } :
                  { label: 'Room to grow 🌱',        color: 'text-slate-400',   bar: 'bg-slate-500'   }

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-medium text-slate-400">Weekly Score</p>
          </div>
          <p className={cn('text-3xl font-bold mt-0.5', color)}>{score}%</p>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          {streakBonus > 0 && (
            <p className="text-xs text-amber-400/70 mt-0.5">+{streakBonus} streak bonus</p>
          )}
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-slate-500">
            <span className="text-emerald-400 font-medium">{done}</span> completed
          </p>
          <p className="text-xs text-slate-500">
            <span className="text-red-400 font-medium">{missed}</span> missed
          </p>
          <p className="text-xs text-slate-600">{total} logged · keystone 2×</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', bar)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function HabitTracker() {
  const [logsUnavailable, setLogsUnavail] = useState(false)
  const [userId, setUserId]               = useState<string | null>(null)
  const [markingId, setMarkingId]         = useState<string | null>(null)
  const [keystoneId, setKeystoneId]       = useState<string | null>(null)
  const [editTarget, setEditTarget]       = useState<Habit | null>(null)
  const [detailTarget, setDetailTarget]   = useState<Habit | null>(null)
  const [bannerExpanded, setBannerExpanded]     = useState(false)
  const [bannerDismissed, setBannerDismissedRaw] = useState(false)
  const [catchUpId, setCatchUpId]               = useState<string | null>(null)
  const { celebrate, celebrationNode } = useHabitCelebration()
  const { celebrateMilestones } = useReward()

  // Mutations below need the user id; the cached queries resolve it internally
  // but don't expose it, so we resolve it once here for write call-sites.
  useEffect(() => {
    createSupabaseBrowserClient().auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    try { setBannerDismissedRaw(localStorage.getItem(`habit_grace_dismissed_${todayStr()}`) === '1') } catch {}
  }, [])

  const {
    data: habits, loading: habitsLoading, isOffline: habitsOffline,
    refetch: fetchData, setData: setHabits,
  } = useCachedQuery<Habit[]>(
    'personality-habits',
    (supabase, userId) => supabase
      .from('personality_habits')
      .select('id, habit_name, category, frequency, streak_count, longest_streak, last_done_at, is_keystone, is_global, created_at')
      .or(`user_id.eq.${userId},is_global.eq.true`)
      .order('is_global', { ascending: true })
      .order('created_at', { ascending: true }),
    []
  )

  const {
    data: globalKeystoneMarks, setData: setGlobalKeystoneMarks,
  } = useCachedQuery<KeystoneMark[]>(
    'global-keystone-marks',
    (supabase, userId) => supabase
      .from('user_habit_keystones')
      .select('habit_id')
      .eq('user_id', userId),
    []
  )

  const globalKeystoneIds = useMemo(
    () => new Set(globalKeystoneMarks.map(k => k.habit_id)),
    [globalKeystoneMarks]
  )

  const {
    data: hiddenHabitMarks, setData: setHiddenHabitMarks,
  } = useCachedQuery<HiddenMark[]>(
    'hidden-global-habits',
    (supabase, userId) => supabase
      .from('user_hidden_habits')
      .select('habit_id')
      .eq('user_id', userId),
    []
  )

  const hiddenHabitIds = useMemo(
    () => new Set(hiddenHabitMarks.map(h => h.habit_id)),
    [hiddenHabitMarks]
  )

  // habits minus any global habit this user has hidden — the source every
  // render-facing computation below should read from instead of `habits`.
  // `habits` itself stays unfiltered so the manage-global-habits modal (Task 3)
  // can still list and restore hidden ones.
  const visibleHabits = useMemo(
    () => habits.filter(h => !h.is_global || !hiddenHabitIds.has(h.id)),
    [habits, hiddenHabitIds]
  )

  const weekStart = getWeekStart()
  const {
    data: weekLogs, loading: logsLoading, isOffline: logsOffline, setData: setWeekLogs,
  } = useCachedQuery<HabitLog[]>(
    `habit-logs:${weekStart}`,
    (supabase, userId) => supabase
      .from('habit_logs')
      .select('habit_id, log_date, status')
      .eq('user_id', userId)
      .gte('log_date', weekStart),
    [],
    [weekStart]
  )

  const yesterday = yesterdayStr()
  const {
    data: yesterdayLogs, loading: yesterdayLogsLoading, isOffline: yesterdayLogsOffline, setData: setYesterdayLogs,
  } = useCachedQuery<HabitLog[]>(
    `habit-logs:${yesterday}`,
    (supabase, userId) => supabase
      .from('habit_logs')
      .select('habit_id, log_date, status')
      .eq('user_id', userId)
      .eq('log_date', yesterday),
    [],
    [yesterday]
  )

  const loading   = habitsLoading || logsLoading
  const isOffline = habitsOffline || logsOffline

  function getStatus(habitId: string): LogStatus {
    const today = todayStr()
    const log = weekLogs.find(l => l.habit_id === habitId && l.log_date === today)
    // Normalize the cron's silent 'auto_missed' backfill to 'missed' here —
    // every other code path in this file (LogStatus, undoLog, the
    // pending/done/skipped filters, the JSX icon branches) only ever needs
    // to distinguish user-initiated 'missed' from 'done'/'pending'; only
    // isPerfectDay (src/lib/perfectDay.ts) treats 'auto_missed' differently.
    if (log) return log.status === 'auto_missed' ? 'missed' : log.status
    const habit = habits.find(h => h.id === habitId)
    // Fall back to last_done_at — covers both when habit_logs is unavailable and
    // when a done entry exists in personality_habits but is absent from habit_logs.
    // NEVER for global habits: that row is a single shared column across every
    // user, so it can never answer "did THIS user complete it today" — only this
    // user's own habit_logs entry (checked above) can. Falling through here for
    // a global habit would show it "done" for every user once any one value on
    // that shared row happens to land on today's date.
    if (habit?.is_global) return 'pending'
    if (habit?.last_done_at && localDateStr(new Date(habit.last_done_at)) === today) return 'done'
    return 'pending'
  }

  function isKeystoneFor(habit: Habit): boolean {
    return habit.is_global ? globalKeystoneIds.has(habit.id) : habit.is_keystone
  }

  async function markDone(habit: Habit) {
    if (getStatus(habit.id) !== 'pending' || markingId || !userId) return
    setMarkingId(habit.id)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)
    const now   = new Date().toISOString()
    const today = todayStr()

    // Optimistic update
    setHabits(prev => prev.map(h => h.id === habit.id
      ? { ...h, streak_count: newStreak, longest_streak: Math.max(newStreak, h.longest_streak), last_done_at: now }
      : h
    ))
    setWeekLogs(prev => [
      ...prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)),
      { habit_id: habit.id, log_date: today, status: 'done' },
    ])

    try {
      const { streak_count, milestones } = await completeHabit(habit.id)
      // Reconcile the optimistic streak with the server-computed value (source of truth).
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: now }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      // If the write failed, mark logs unavailable so the fallback UI kicks in
      setLogsUnavail(true)
    }
    setMarkingId(null)
  }

  function dismissBanner() {
    setBannerDismissedRaw(true)
    try { localStorage.setItem(`habit_grace_dismissed_${todayStr()}`, '1') } catch {}
  }

  async function markDoneForYesterday(habit: Habit) {
    if (catchUpId || !userId) return

    // Defense-in-depth: never roll last_done_at backwards. If the habit was
    // already completed today (or otherwise has a last_done_at on/after
    // yesterday), catching up "yesterday" would corrupt the streak — the UI
    // filter should already exclude this habit from the banner, but this
    // write is consequential enough to guard independently.
    const yesterdayMidnight = new Date()
    yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1)
    yesterdayMidnight.setHours(0, 0, 0, 0)
    if (habit.last_done_at) {
      const lastMidnight = new Date(habit.last_done_at)
      lastMidnight.setHours(0, 0, 0, 0)
      if (lastMidnight.getTime() >= yesterdayMidnight.getTime()) return
    }

    setCatchUpId(habit.id)
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency, yesterdayDate)
    const yesterdayIso = yesterdayDate.toISOString()

    setHabits(prev => prev.map(h => h.id === habit.id
      ? { ...h, streak_count: newStreak, longest_streak: Math.max(newStreak, h.longest_streak), last_done_at: yesterdayIso }
      : h
    ))
    setYesterdayLogs(prev => [
      ...prev.filter(l => l.habit_id !== habit.id),
      { habit_id: habit.id, log_date: yesterday, status: 'done' },
    ])
    // Only touch weekLogs (which feeds the weekly score card) when yesterday
    // actually falls within the currently-fetched week range — i.e. skip this
    // when today is Monday, since then yesterday belongs to last week.
    if (yesterday >= weekStart) {
      setWeekLogs(prev => [
        ...prev.filter(l => !(l.habit_id === habit.id && l.log_date === yesterday)),
        { habit_id: habit.id, log_date: yesterday, status: 'done' },
      ])
    }

    try {
      const { streak_count, milestones } = await completeHabit(habit.id, 'yesterday')
      // Reconcile the optimistic streak with the server-computed value (source of truth).
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: yesterdayIso }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      // no rollback — matches prior behavior where optimistic state persisted on write failure
    }
    setCatchUpId(null)
  }

  async function markMissed(habit: Habit) {
    if (getStatus(habit.id) !== 'pending' || markingId || !userId) return
    setMarkingId(habit.id)
    const today = todayStr()

    setWeekLogs(prev => [
      ...prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)),
      { habit_id: habit.id, log_date: today, status: 'missed' },
    ])
    writeTodayMissed([...readTodayMissed().filter(id => id !== habit.id), habit.id])

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.from('habit_logs').upsert(
      { user_id: userId, habit_id: habit.id, log_date: today, status: 'missed' },
      { onConflict: 'habit_id,user_id,log_date' }
    )
    if (error) setLogsUnavail(true)
    setMarkingId(null)
  }

  async function undoLog(habit: Habit) {
    const status = getStatus(habit.id)
    if (status === 'pending' || markingId) return
    setMarkingId(habit.id)
    const today = todayStr()

    setWeekLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)))

    const supabase = createSupabaseBrowserClient()
    if (status === 'done') {
      const newStreak = Math.max(0, habit.streak_count - 1)
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count: newStreak, last_done_at: null }
        : h
      ))
      const deleteLog = supabase.from('habit_logs').delete()
        .eq('habit_id', habit.id).eq('user_id', userId!).eq('log_date', today)
      const updateHabit = habit.is_global
        ? Promise.resolve()
        : supabase.from('personality_habits').update({
            streak_count: newStreak, last_done_at: null, updated_at: new Date().toISOString(),
          }).eq('id', habit.id)
      await Promise.all([deleteLog, updateHabit])

      // Reverse the base daily points this completion earned — only the
      // base amount (5 or 10 for keystone), not any milestone/perfect-day
      // bonuses, which stay earned (matches this feature's existing "no
      // streak-loss penalty" principle). A failed reversal must never block
      // or roll back the undo above (already applied) — same non-blocking
      // error-logging discipline TodoList.tsx already uses for its own
      // points-award/reversal calls.
      if (userId) {
        const delta = -(isKeystoneFor(habit) ? DAILY_POINTS_KEYSTONE : DAILY_POINTS)
        const { error: rewardsUpsertErr } = await supabase.from('user_rewards').upsert(
          { user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }
        )
        if (rewardsUpsertErr) console.error('Failed to reverse habit undo points:', rewardsUpsertErr)
        const { error: logErr } = await supabase.from('reward_points_log')
          .insert({ user_id: userId, delta, reason: `Undo: ${habit.habit_name}` })
        if (logErr) console.error('Failed to reverse habit undo points:', logErr)
        const { error: rpcErr } = await supabase.rpc('increment_points_balance', { p_user_id: userId, p_delta: delta })
        if (rpcErr) console.error('Failed to reverse habit undo points:', rpcErr)
      }
    } else {
      writeTodayMissed(readTodayMissed().filter(id => id !== habit.id))
      await supabase.from('habit_logs').delete()
        .eq('habit_id', habit.id).eq('user_id', userId!).eq('log_date', today)
    }

    setMarkingId(null)
  }

  async function deleteHabit(id: string) {
    const supabase = createSupabaseBrowserClient()
    await supabase.from('personality_habits').delete().eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
    setWeekLogs(prev => prev.filter(l => l.habit_id !== id))
  }

  async function toggleKeystone(habit: Habit) {
    if (keystoneId || !userId) return
    const alreadyKeystone = isKeystoneFor(habit)
    const keystoneCount = visibleHabits.filter(isKeystoneFor).length
    if (!alreadyKeystone && keystoneCount >= 2) return  // enforced in UI
    setKeystoneId(habit.id)
    const supabase = createSupabaseBrowserClient()

    if (habit.is_global) {
      const next = !alreadyKeystone
      setGlobalKeystoneMarks(prev => next
        ? [...prev, { habit_id: habit.id }]
        : prev.filter(k => k.habit_id !== habit.id))
      if (next) {
        await supabase.from('user_habit_keystones').insert({ user_id: userId, habit_id: habit.id })
      } else {
        await supabase.from('user_habit_keystones').delete()
          .eq('user_id', userId).eq('habit_id', habit.id)
      }
    } else {
      const next = !habit.is_keystone
      setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, is_keystone: next } : h))
      await supabase.from('personality_habits')
        .update({ is_keystone: next })
        .eq('id', habit.id)
    }

    setKeystoneId(null)
  }

  async function hideGlobalHabit(habitId: string) {
    if (!userId) return
    setHiddenHabitMarks(prev => prev.some(h => h.habit_id === habitId) ? prev : [...prev, { habit_id: habitId }])
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_hidden_habits').insert({ user_id: userId, habit_id: habitId })
  }

  async function unhideGlobalHabit(habitId: string) {
    if (!userId) return
    const supabase = createSupabaseBrowserClient()

    // Product decision: auto-unmark keystone on restore if it would exceed the
    // 2-keystone cap. `visibleHabits` here still excludes `habitId` (it's still
    // hidden until the setHiddenHabitMarks update below takes effect), so
    // currentKeystoneCount correctly reflects the pre-restore state — the
    // correct baseline to compare against the cap.
    const wasKeystone = globalKeystoneIds.has(habitId)
    const currentKeystoneCount = visibleHabits.filter(isKeystoneFor).length
    const wouldExceedCap = wasKeystone && currentKeystoneCount >= 2

    setHiddenHabitMarks(prev => prev.filter(h => h.habit_id !== habitId))
    if (wouldExceedCap) {
      setGlobalKeystoneMarks(prev => prev.filter(k => k.habit_id !== habitId))
    }

    await supabase.from('user_hidden_habits').delete().eq('user_id', userId).eq('habit_id', habitId)
    if (wouldExceedCap) {
      await supabase.from('user_habit_keystones').delete().eq('user_id', userId).eq('habit_id', habitId)
    }
  }

  const graceOpen = isGraceActive() && !yesterdayLogsOffline && !yesterdayLogsLoading
  const catchableHabits = graceOpen
    ? visibleHabits.filter(h => h.frequency === 'daily' && getStatus(h.id) !== 'done' && !yesterdayLogs.some(l => l.habit_id === h.id && l.status === 'done'))
    : []

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  // Keystone first, then pending, then done — skipped habits shown below.
  // Sourced from visibleHabits (not habits) so a hidden global habit never renders.
  const pending = visibleHabits.filter(h => getStatus(h.id) === 'pending')
  const done    = visibleHabits.filter(h => getStatus(h.id) === 'done')
  const skipped = visibleHabits.filter(h => getStatus(h.id) === 'missed')
  const sortedHabits = [
    ...pending.filter(h => isKeystoneFor(h)),
    ...pending.filter(h => !isKeystoneFor(h)),
    ...done.filter(h => isKeystoneFor(h)),
    ...done.filter(h => !isKeystoneFor(h)),
  ]

  const keystoneCount = visibleHabits.filter(isKeystoneFor).length

  // Weighted score: keystone logs count 2×, regular logs count 1×
  const habitWeight = (id: string) => {
    const habit = habits.find(h => h.id === id)
    return habit && isKeystoneFor(habit) ? 2 : 1
  }
  const weekDone      = weekLogs.filter(l => l.status === 'done').length
  const weekMissed    = weekLogs.filter(l => l.status === 'missed' || l.status === 'auto_missed').length
  const weightedDone  = weekLogs.filter(l => l.status === 'done').reduce((s, l) => s + habitWeight(l.habit_id), 0)
  const weightedTotal = weekLogs.reduce((s, l) => s + habitWeight(l.habit_id), 0)
  const topStreak  = visibleHabits.reduce((m, h) => Math.max(m, h.streak_count), 0)

  // Average streak of habits completed at least once this week (for streak bonus)
  const completedHabitIds = new Set(weekLogs.filter(l => l.status === 'done').map(l => l.habit_id))
  const completedHabits   = habits.filter(h => completedHabitIds.has(h.id))
  const avgCompletedStreak = completedHabits.length
    ? completedHabits.reduce((s, h) => s + (h.streak_count ?? 0), 0) / completedHabits.length
    : 0

  return (
    <div className="space-y-4">
      {celebrationNode}

      {/* Grace-period catch-up banner */}
      {catchableHabits.length > 0 && !bannerDismissed && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 overflow-hidden">
          <button
            onClick={() => setBannerExpanded(e => !e)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-sm text-amber-200">
              {catchableHabits.length} habit{catchableHabits.length > 1 ? 's' : ''} missed yesterday — grace ends at 12:00 PM
            </span>
            <span
              onClick={e => { e.stopPropagation(); dismissBanner() }}
              role="button"
              aria-label="Dismiss"
              className="text-amber-400/60 hover:text-amber-300 shrink-0"
            >
              <X className="h-4 w-4" />
            </span>
          </button>
          {bannerExpanded && (
            <div className="border-t border-amber-500/20 px-4 py-3 space-y-2">
              {catchableHabits.map(habit => (
                <div key={habit.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300 truncate">{habit.habit_name}</span>
                  <button
                    onClick={() => markDoneForYesterday(habit)}
                    disabled={catchUpId === habit.id}
                    className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {catchUpId === habit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Mark done
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit modal (controlled) */}
      {editTarget && (
        <EditHabitModal
          habit={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={() => { fetchData(); setEditTarget(null) }}
        />
      )}

      {/* Habit detail modal (controlled) */}
      {detailTarget && (
        <HabitDetailModal
          habit={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Habit Tracker</h2>
          {visibleHabits.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {done.length}/{visibleHabits.length} done today
              {topStreak > 0 && ` · 🔥 Best streak: ${topStreak}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {habits.some(h => h.is_global) && (
            <ManageGlobalHabitsModal
              globalHabits={habits.filter(h => h.is_global)}
              hiddenIds={hiddenHabitIds}
              onHide={hideGlobalHabit}
              onUnhide={unhideGlobalHabit}
            />
          )}
          <AddHabitModal onAdd={fetchData} />
        </div>
      </div>

      {/* Weekly score */}
      <WeeklyScoreCard done={weekDone} missed={weekMissed} weightedDone={weightedDone} weightedTotal={weightedTotal} avgCompletedStreak={avgCompletedStreak} />

      {/* Empty state */}
      {visibleHabits.length === 0 && isOffline && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <Flame className="h-10 w-10 text-orange-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Can&apos;t load — you&apos;re offline.</p>
        </div>
      )}

      {visibleHabits.length === 0 && !isOffline && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <Flame className="h-10 w-10 text-orange-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No habits yet.</p>
          <p className="text-slate-600 text-xs mt-1">Add one above to start building streaks.</p>
        </div>
      )}

      {/* Keystone hint */}
      {keystoneCount < 2 && visibleHabits.length >= 2 && (
        <p className="text-xs text-amber-500/60 px-1 flex items-center gap-1.5">
          <Crown className="h-3 w-3" />
          Tap the crown on up to 2 habits to mark them as keystone — they count 2× in your score.
        </p>
      )}

      {/* Habit list */}
      <div className="space-y-2">
        {sortedHabits.map(habit => {
          const status = getStatus(habit.id)
          const cat    = CATEGORY_STYLES[habit.category] ?? CATEGORY_STYLES.health
          const keystone = isKeystoneFor(habit)
          const canMarkKeystone = keystone || keystoneCount < 2

          return (
            <div
              key={habit.id}
              onClick={() => setDetailTarget(habit)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                // Only react when the row itself has focus — a nested button
                // (mark done, edit, etc.) receiving Enter/Space should just
                // activate normally, not also open the detail modal, since
                // keydown bubbles here regardless of the button's own
                // stopPropagation on its click handler.
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailTarget(habit) }
              }}
              aria-label={`View history for ${habit.habit_name}`}
              className={cn(
                'group flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all cursor-pointer',
                keystone && status === 'pending' && 'border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-transparent shadow-[0_0_12px_-4px_rgba(245,158,11,0.3)]',
                keystone && status === 'done'    && 'border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-emerald-500/5',
                !keystone && status === 'done'    && 'border-emerald-500/20 bg-emerald-500/5',
                !keystone && status === 'pending' && 'border-white/10 bg-white/5 hover:border-white/20',
              )}
            >
              {/* Status button */}
              {status === 'pending' ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); markDone(habit) }}
                    disabled={!!markingId}
                    aria-label="Mark done"
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-600 hover:border-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    {markingId === habit.id
                      ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                      : <Check className="h-3 w-3 text-slate-600 hover:text-emerald-400" />}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); markMissed(habit) }}
                    disabled={!!markingId}
                    aria-label="Not possible today"
                    title="Not possible today"
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-700 hover:border-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <XCircle className="h-3.5 w-3.5 text-slate-700 hover:text-red-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); undoLog(habit) }}
                  disabled={markingId === habit.id}
                  aria-label="Undo"
                  className={cn(
                    'group/undo flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    status === 'done'
                      ? 'border-emerald-400 bg-emerald-400 hover:bg-slate-700 hover:border-slate-500'
                      : 'border-red-400 bg-red-400 hover:bg-slate-700 hover:border-slate-500'
                  )}
                >
                  {markingId === habit.id ? (
                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                  ) : status === 'done' ? (
                    <>
                      <Check     className="h-3 w-3 text-white group-hover/undo:hidden" />
                      <RotateCcw className="h-3 w-3 text-slate-300 hidden group-hover/undo:block" />
                    </>
                  ) : (
                    <>
                      <XCircle   className="h-3 w-3 text-white group-hover/undo:hidden" />
                      <RotateCcw className="h-3 w-3 text-slate-300 hidden group-hover/undo:block" />
                    </>
                  )}
                </button>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  {habit.is_global && <Globe className="h-3 w-3 shrink-0 text-emerald-400" />}
                  {keystone && (
                    <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  )}
                  <p className={cn(
                    'text-sm font-medium line-clamp-2',
                    keystone && status === 'pending' && 'text-amber-100',
                    !keystone && status === 'pending' && 'text-white',
                    status === 'done' && 'text-slate-500 line-through',
                  )}>
                    {habit.habit_name}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {habit.is_global && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                      Global
                    </span>
                  )}
                  {keystone && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium tracking-wide uppercase">
                      Keystone
                    </span>
                  )}
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', cat.badge)}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-slate-600">{FREQUENCY_LABELS[habit.frequency]}</span>
                </div>
              </div>

              {/* Streak — not shown for global (no per-user streak tracked on habit row) */}
              {habit.streak_count > 0 && !habit.is_global && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-orange-400">🔥</span>
                  <span className="text-sm font-semibold text-orange-300">
                    {habit.streak_count}
                    <span className="text-xs font-normal text-slate-500 ml-0.5">days</span>
                  </span>
                </div>
              )}

              {/* Crown toggle */}
              <button
                onClick={e => { e.stopPropagation(); canMarkKeystone && toggleKeystone(habit) }}
                disabled={!!keystoneId || !canMarkKeystone}
                aria-label={keystone ? 'Remove keystone' : 'Mark as keystone'}
                title={
                  keystone ? 'Remove keystone'
                  : canMarkKeystone ? 'Mark as keystone (2× score weight)'
                  : 'Maximum 2 keystone habits'
                }
                className={cn(
                  'shrink-0 transition-all opacity-0 group-hover:opacity-100',
                  keystone
                    ? 'text-amber-400 opacity-100 hover:text-amber-300'
                    : canMarkKeystone
                      ? 'text-slate-600 hover:text-amber-400'
                      : 'text-slate-800 cursor-not-allowed',
                )}
              >
                {keystoneId === habit.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Crown className="h-4 w-4" />}
              </button>

              {/* Edit / Delete — hidden for global habits */}
              {!habit.is_global && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); setEditTarget(habit) }}
                    aria-label="Edit habit"
                    className="shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-violet-400 transition-all"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteHabit(habit.id) }}
                    aria-label="Delete habit"
                    className="ml-1 shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Not possible today — shown below main list, tap X to undo */}
      {skipped.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs text-slate-600 px-1">
            {skipped.length} not possible today
          </p>
          {skipped.map(habit => {
            const cat = CATEGORY_STYLES[habit.category] ?? CATEGORY_STYLES.health
            return (
              <div key={habit.id}
                className="group flex items-center gap-3 rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3 transition-all">
                {/* Red X — tap to undo */}
                <button
                  onClick={() => undoLog(habit)}
                  disabled={markingId === habit.id}
                  aria-label="Undo — mark as pending"
                  title="Tap to undo"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-red-400 bg-red-400 hover:bg-slate-700 hover:border-slate-500 transition-all group/undo"
                >
                  {markingId === habit.id
                    ? <Loader2 className="h-3 w-3 animate-spin text-white" />
                    : <>
                        <XCircle  className="h-3.5 w-3.5 text-white group-hover/undo:hidden" />
                        <RotateCcw className="h-3 w-3 text-slate-300 hidden group-hover/undo:block" />
                      </>}
                </button>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm text-slate-500 line-through line-clamp-2">{habit.habit_name}</p>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', cat.badge)}>
                    {cat.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
