'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Flame, Plus, Trash2, Check, Loader2, AlertCircle,
  RefreshCw, RotateCcw, XCircle, Trophy,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Category  = 'mindset' | 'social' | 'productivity'
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
}

interface HabitLog {
  habit_id: string
  log_date: string   // YYYY-MM-DD
  status: 'done' | 'missed'
}

const CATEGORY_STYLES: Record<Category, { label: string; badge: string }> = {
  mindset:      { label: '🧠 Mindset',      badge: 'bg-violet-500/20 text-violet-300' },
  social:       { label: '🤝 Social',       badge: 'bg-sky-500/20 text-sky-300' },
  productivity: { label: '⚡ Productivity', badge: 'bg-emerald-500/20 text-emerald-300' },
}

const FREQUENCY_LABELS: Record<Frequency, string> = { daily: 'Daily', weekly: 'Weekly' }

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay() || 7     // Mon=1 … Sun=7
  d.setDate(d.getDate() - (day - 1))
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function computeStreak(current: number, lastDoneAt: string | null, frequency: Frequency): number {
  if (!lastDoneAt) return 1
  const last = new Date(lastDoneAt)
  last.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000)
  if (frequency === 'daily') {
    if (diffDays === 0) return current
    if (diffDays === 1) return current + 1
    return 1
  }
  if (diffDays === 0) return current
  if (diffDays <= 7) return current + 1
  return 1
}

// ─── Add Habit Modal ──────────────────────────────────────────

function AddHabitModal({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen]           = useState(false)
  const [name, setName]           = useState('')
  const [category, setCategory]   = useState<Category>('mindset')
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
    setName(''); setCategory('mindset'); setFrequency('daily')
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

// ─── Weekly Score Card ────────────────────────────────────────

function WeeklyScoreCard({ done, missed }: { done: number; missed: number }) {
  const total = done + missed
  if (total === 0) return null

  const score = Math.round((done / total) * 100)
  const { label, color, bar } =
    score >= 80 ? { label: 'Excellent week! 🎯', color: 'text-emerald-400', bar: 'bg-emerald-500' } :
    score >= 60 ? { label: 'Good progress 💪',   color: 'text-sky-400',     bar: 'bg-sky-500'     } :
    score >= 40 ? { label: 'Keep going 📈',       color: 'text-amber-400',   bar: 'bg-amber-500'   } :
                  { label: 'Room to grow 🌱',      color: 'text-slate-400',   bar: 'bg-slate-500'   }

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
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-slate-500">
            <span className="text-emerald-400 font-medium">{done}</span> completed
          </p>
          <p className="text-xs text-slate-500">
            <span className="text-red-400 font-medium">{missed}</span> missed
          </p>
          <p className="text-xs text-slate-600">{total} logged this week</p>
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
  const [habits, setHabits]         = useState<Habit[]>([])
  const [weekLogs, setWeekLogs]     = useState<HabitLog[]>([])
  const [userId, setUserId]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [markingId, setMarkingId]   = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setFetchError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setFetchError('No active session — please sign out and sign in again.')
      setLoading(false)
      return
    }

    setUserId(session.user.id)
    const weekStart = getWeekStart()

    const [habitsRes, logsRes] = await Promise.all([
      supabase
        .from('personality_habits')
        .select('id, habit_name, category, frequency, streak_count, longest_streak, last_done_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('habit_logs')
        .select('habit_id, log_date, status')
        .gte('log_date', weekStart),
    ])

    if (habitsRes.error) { setFetchError(habitsRes.error.message); setLoading(false); return }
    setHabits((habitsRes.data as Habit[]) ?? [])
    setWeekLogs((logsRes.data as HabitLog[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function getStatus(habitId: string): LogStatus {
    const log = weekLogs.find(l => l.habit_id === habitId && l.log_date === todayStr())
    return log?.status ?? 'pending'
  }

  async function markDone(habit: Habit) {
    if (getStatus(habit.id) !== 'pending' || markingId || !userId) return
    setMarkingId(habit.id)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)
    const now = new Date().toISOString()
    const today = todayStr()

    setHabits(prev => prev.map(h => h.id === habit.id
      ? { ...h, streak_count: newStreak, longest_streak: Math.max(newStreak, h.longest_streak), last_done_at: now }
      : h
    ))
    setWeekLogs(prev => [
      ...prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)),
      { habit_id: habit.id, log_date: today, status: 'done' },
    ])
    setMarkingId(null)

    const supabase = createSupabaseBrowserClient()
    await Promise.all([
      supabase.from('personality_habits').update({
        streak_count:   newStreak,
        longest_streak: Math.max(newStreak, habit.longest_streak),
        last_done_at:   now,
        updated_at:     now,
      }).eq('id', habit.id),
      supabase.from('habit_logs').upsert(
        { user_id: userId, habit_id: habit.id, log_date: today, status: 'done' },
        { onConflict: 'habit_id,log_date' }
      ),
    ])
  }

  async function markMissed(habit: Habit) {
    if (getStatus(habit.id) !== 'pending' || markingId || !userId) return
    setMarkingId(habit.id)
    const today = todayStr()

    setWeekLogs(prev => [
      ...prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)),
      { habit_id: habit.id, log_date: today, status: 'missed' },
    ])
    setMarkingId(null)

    const supabase = createSupabaseBrowserClient()
    await supabase.from('habit_logs').upsert(
      { user_id: userId, habit_id: habit.id, log_date: today, status: 'missed' },
      { onConflict: 'habit_id,log_date' }
    )
  }

  async function undoLog(habit: Habit) {
    const status = getStatus(habit.id)
    if (status === 'pending' || markingId) return
    setMarkingId(habit.id)
    const today = todayStr()

    setWeekLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)))

    // If undoing a done, also roll back streak
    if (status === 'done') {
      const newStreak = Math.max(0, habit.streak_count - 1)
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count: newStreak, last_done_at: null }
        : h
      ))
      const supabase = createSupabaseBrowserClient()
      await Promise.all([
        supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('log_date', today),
        supabase.from('personality_habits').update({
          streak_count: newStreak, last_done_at: null, updated_at: new Date().toISOString(),
        }).eq('id', habit.id),
      ])
    } else {
      const supabase = createSupabaseBrowserClient()
      await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('log_date', today)
    }

    setMarkingId(null)
  }

  async function deleteHabit(id: string) {
    const supabase = createSupabaseBrowserClient()
    await supabase.from('personality_habits').delete().eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
    setWeekLogs(prev => prev.filter(l => l.habit_id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  if (fetchError) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center space-y-3">
      <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
      <p className="text-sm text-red-400">{fetchError}</p>
      <button onClick={fetchData}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  )

  // Pending first, then done, then missed
  const pending = habits.filter(h => getStatus(h.id) === 'pending')
  const done    = habits.filter(h => getStatus(h.id) === 'done')
  const missed  = habits.filter(h => getStatus(h.id) === 'missed')
  const sortedHabits = [...pending, ...done, ...missed]

  const weekDone   = weekLogs.filter(l => l.status === 'done').length
  const weekMissed = weekLogs.filter(l => l.status === 'missed').length
  const topStreak  = habits.reduce((m, h) => Math.max(m, h.streak_count), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Habit Tracker</h2>
          {habits.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {done.length}/{habits.length} done today
              {topStreak > 0 && ` · 🔥 Best streak: ${topStreak}`}
            </p>
          )}
        </div>
        <AddHabitModal onAdd={fetchData} />
      </div>

      {/* Weekly score */}
      <WeeklyScoreCard done={weekDone} missed={weekMissed} />

      {/* Empty state */}
      {habits.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <Flame className="h-10 w-10 text-orange-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No habits yet.</p>
          <p className="text-slate-600 text-xs mt-1">Add one above to start building streaks.</p>
        </div>
      )}

      {/* Habit list */}
      <div className="space-y-2">
        {sortedHabits.map(habit => {
          const status = getStatus(habit.id)
          const cat    = CATEGORY_STYLES[habit.category] ?? CATEGORY_STYLES.mindset

          return (
            <div
              key={habit.id}
              className={cn(
                'group flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all',
                status === 'done'   && 'border-emerald-500/20 bg-emerald-500/5',
                status === 'missed' && 'border-red-500/20 bg-red-500/5',
                status === 'pending' && 'border-white/10 bg-white/5 hover:border-white/20',
              )}
            >
              {/* Status button */}
              {status === 'pending' ? (
                // Two buttons: check (done) + X (missed)
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => markDone(habit)}
                    disabled={!!markingId}
                    aria-label="Mark done"
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-600 hover:border-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    {markingId === habit.id
                      ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                      : <Check className="h-3 w-3 text-slate-600 hover:text-emerald-400" />}
                  </button>
                  <button
                    onClick={() => markMissed(habit)}
                    disabled={!!markingId}
                    aria-label="Mark missed"
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-700 hover:border-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <XCircle className="h-3.5 w-3.5 text-slate-700 hover:text-red-400" />
                  </button>
                </div>
              ) : (
                // Single undo button (done = green, missed = red)
                <button
                  onClick={() => undoLog(habit)}
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
                      <Check    className="h-3 w-3 text-white group-hover/undo:hidden" />
                      <RotateCcw className="h-3 w-3 text-slate-300 hidden group-hover/undo:block" />
                    </>
                  ) : (
                    <>
                      <XCircle  className="h-3 w-3 text-white group-hover/undo:hidden" />
                      <RotateCcw className="h-3 w-3 text-slate-300 hidden group-hover/undo:block" />
                    </>
                  )}
                </button>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className={cn(
                  'text-sm font-medium truncate',
                  status === 'done'    && 'text-slate-500 line-through',
                  status === 'missed'  && 'text-slate-500 line-through',
                  status === 'pending' && 'text-white',
                )}>
                  {habit.habit_name}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', cat.badge)}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-slate-600">{FREQUENCY_LABELS[habit.frequency]}</span>
                  {status === 'missed' && (
                    <span className="text-xs text-red-400/70">Missed today</span>
                  )}
                </div>
              </div>

              {/* Streak */}
              {habit.streak_count > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-orange-400">🔥</span>
                  <span className="text-sm font-semibold text-orange-300">
                    {habit.streak_count}
                    <span className="text-xs font-normal text-slate-500 ml-0.5">days</span>
                  </span>
                </div>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteHabit(habit.id)}
                aria-label="Delete habit"
                className="ml-1 shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
