'use client'

import { useState, useEffect, useCallback } from 'react'
import { Flame, Plus, Trash2, Check, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────

type Category = 'mindset' | 'social' | 'productivity'
type Frequency = 'daily' | 'weekly'

interface Habit {
  id: string
  habit_name: string
  category: Category
  frequency: Frequency
  streak_count: number
  longest_streak: number
  last_done_at: string | null
}

// ─── Constants ────────────────────────────────────────────────

const CATEGORY_STYLES: Record<Category, { label: string; badge: string }> = {
  mindset:      { label: '🧠 Mindset',      badge: 'bg-violet-500/20 text-violet-300' },
  social:       { label: '🤝 Social',       badge: 'bg-sky-500/20 text-sky-300' },
  productivity: { label: '⚡ Productivity', badge: 'bg-emerald-500/20 text-emerald-300' },
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily:  'Daily',
  weekly: 'Weekly',
}

// ─── Helpers ─────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function isDoneToday(habit: Habit): boolean {
  if (!habit.last_done_at) return false
  if (habit.frequency === 'daily') return habit.last_done_at.startsWith(todayStr())
  // weekly: done if last_done_at is within the current ISO week
  const last = new Date(habit.last_done_at)
  const now  = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return last >= startOfWeek
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
  // weekly: continue streak if within 7 days
  if (diffDays === 0) return current
  if (diffDays <= 7) return current + 1
  return 1
}

// ─── Add Habit Modal ─────────────────────────────────────────

function AddHabitModal({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('mindset')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [saving, setSaving] = useState(false)
  const supabase = createSupabaseBrowserClient()

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('personality_habits').insert({
      user_id: user.id,
      habit_name: name.trim(),
      category,
      frequency,
    })
    setName('')
    setCategory('mindset')
    setFrequency('daily')
    setSaving(false)
    setOpen(false)
    onAdd()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Habit
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Habit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-name" className="text-slate-300">Habit name</Label>
            <Input
              id="habit-name"
              autoFocus
              placeholder="e.g. 10 min meditation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(CATEGORY_STYLES) as [Category, typeof CATEGORY_STYLES[Category]][]).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={cn(
                    'rounded-lg border py-2 px-3 text-xs font-medium transition-all',
                    category === key
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Frequency</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['daily', 'weekly'] as Frequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={cn(
                    'rounded-lg border py-2.5 text-sm font-medium transition-all capitalize',
                    frequency === f
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleAdd}
            disabled={saving || !name.trim()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Habit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const supabase = createSupabaseBrowserClient()

  const fetchHabits = useCallback(async () => {
    const { data, error } = await supabase
      .from('personality_habits')
      .select('id, habit_name, category, frequency, streak_count, longest_streak, last_done_at')
      .order('created_at', { ascending: true })
    if (error) console.error('[HabitTracker] fetch error:', error)
    setHabits((data as Habit[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchHabits() }, [fetchHabits])

  async function markDone(habit: Habit) {
    if (isDoneToday(habit) || markingId) return
    setMarkingId(habit.id)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)
    await supabase
      .from('personality_habits')
      .update({
        streak_count: newStreak,
        longest_streak: Math.max(newStreak, habit.longest_streak),
        last_done_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', habit.id)
    setMarkingId(null)
    fetchHabits()
  }

  async function deleteHabit(id: string) {
    await supabase.from('personality_habits').delete().eq('id', id)
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const doneToday  = habits.filter(isDoneToday).length
  const topStreak  = habits.reduce((m, h) => Math.max(m, h.streak_count), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Habit Tracker</h2>
          {habits.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {doneToday}/{habits.length} done today
              {topStreak > 0 && ` · 🔥 Best streak: ${topStreak}`}
            </p>
          )}
        </div>
        <AddHabitModal onAdd={fetchHabits} />
      </div>

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
        {habits.map((habit) => {
          const done = isDoneToday(habit)
          const cat  = CATEGORY_STYLES[habit.category] ?? CATEGORY_STYLES.mindset

          return (
            <div
              key={habit.id}
              className={cn(
                'group flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all',
                done
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => markDone(habit)}
                disabled={done || markingId === habit.id}
                aria-label={done ? 'Done' : 'Mark done'}
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                  done
                    ? 'border-emerald-400 bg-emerald-400 cursor-default'
                    : 'border-slate-600 hover:border-emerald-400 cursor-pointer'
                )}
              >
                {markingId === habit.id
                  ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                  : done && <Check className="h-3 w-3 text-white" />
                }
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className={cn(
                  'text-sm font-medium truncate',
                  done ? 'text-slate-500 line-through' : 'text-white'
                )}>
                  {habit.habit_name}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', cat.badge)}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-slate-600">
                    {FREQUENCY_LABELS[habit.frequency]}
                  </span>
                </div>
              </div>

              {/* Streak badge */}
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
