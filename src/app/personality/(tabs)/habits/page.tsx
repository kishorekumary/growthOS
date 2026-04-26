'use client'

import { useState, useEffect, useCallback } from 'react'
import { Flame, Plus, Trash2, Check, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Habit {
  id: string
  habit_name: string
  description: string | null
  streak_count: number
  longest_streak: number
  last_done_at: string | null
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function isDoneToday(lastDoneAt: string | null) {
  if (!lastDoneAt) return false
  return lastDoneAt.startsWith(todayStr())
}

function computeNewStreak(current: number, lastDoneAt: string | null): number {
  if (!lastDoneAt) return 1
  const last = new Date(lastDoneAt)
  last.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - last.getTime()) / 86400000)
  if (diff === 0) return current
  if (diff === 1) return current + 1
  return 1
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const supabase = createSupabaseBrowserClient()

  const fetchHabits = useCallback(async () => {
    const { data } = await supabase
      .from('personality_habits')
      .select('*')
      .order('streak_count', { ascending: false })
    setHabits(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchHabits() }, [fetchHabits])

  async function addHabit() {
    if (!newName.trim()) return
    setAdding(true)
    await supabase.from('personality_habits').insert({ habit_name: newName.trim() })
    setNewName('')
    setShowForm(false)
    setAdding(false)
    fetchHabits()
  }

  async function markDone(habit: Habit) {
    if (isDoneToday(habit.last_done_at) || markingId) return
    setMarkingId(habit.id)
    const newStreak = computeNewStreak(habit.streak_count, habit.last_done_at)
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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )
  }

  const doneCount = habits.filter((h) => isDoneToday(h.last_done_at)).length
  const totalStreak = habits.reduce((s, h) => s + h.streak_count, 0)

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-xl font-bold text-white">{habits.length}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-xl font-bold text-emerald-400">{doneCount}/{habits.length}</p>
          <p className="text-xs text-slate-500">Done today</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-xl font-bold text-orange-400 flex items-center justify-center gap-1">
            <Flame className="h-4 w-4" />{totalStreak}
          </p>
          <p className="text-xs text-slate-500">Total streak</p>
        </div>
      </div>

      {/* Habits list */}
      <div className="space-y-2">
        {habits.length === 0 && !showForm && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <Flame className="h-10 w-10 text-orange-400/50 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No habits yet. Add one to start building streaks.</p>
          </div>
        )}

        {habits.map((habit) => {
          const done = isDoneToday(habit.last_done_at)
          return (
            <div
              key={habit.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all',
                done ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10 bg-white/5'
              )}
            >
              {/* Done toggle */}
              <button
                onClick={() => markDone(habit)}
                disabled={done || markingId === habit.id}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                  done
                    ? 'border-emerald-400 bg-emerald-400'
                    : 'border-slate-600 hover:border-emerald-400'
                )}
              >
                {markingId === habit.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                  : done && <Check className="h-3.5 w-3.5 text-white" />
                }
              </button>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', done ? 'text-slate-400 line-through' : 'text-white')}>
                  {habit.habit_name}
                </p>
                {habit.longest_streak > 0 && (
                  <p className="text-xs text-slate-600">Best: {habit.longest_streak} days</p>
                )}
              </div>

              {/* Streak */}
              {habit.streak_count > 0 && (
                <div className="flex items-center gap-1 text-orange-400 shrink-0">
                  <Flame className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{habit.streak_count}</span>
                </div>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteHabit(habit.id)}
                className="text-slate-600 hover:text-red-400 transition-colors shrink-0 ml-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Add habit form */}
      {showForm ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <Input
            autoFocus
            placeholder="Habit name (e.g. 10 min meditation)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addHabit() }}
            className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={addHabit}
              disabled={adding || !newName.trim()}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Habit'}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setShowForm(true)}
          variant="outline"
          className="w-full border-dashed border-white/20 bg-transparent text-slate-400 hover:border-white/40 hover:text-white"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Habit
        </Button>
      )}
    </div>
  )
}
