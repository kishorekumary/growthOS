'use client'

import { useMemo } from 'react'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { useInFlightIds } from '@/hooks/useInFlightIds'
import { useReward } from '@/contexts/RewardContext'
import { completeHabit } from '@/lib/completeHabit'
import { localDateStr, todayStr } from '@/lib/habitStreak'
import { periodStart } from '@/lib/planner/periods'

interface HabitRow {
  id:           string
  habit_name:   string
  streak_count: number
  last_done_at: string | null
  frequency:    'daily' | 'weekly'
  is_global:    boolean
}
interface HabitLog { habit_id: string; status: string; log_date: string }

export interface PlannerHabit {
  id:           string
  habit_name:   string
  streak_count: number
  frequency:    'daily' | 'weekly'
  done:         boolean
}

// Today's daily habits and this week's weekly habits, in planner shape.
// Visibility mirrors TodayHabits (own + global minus hidden). Completing goes
// through completeHabit so streaks, chest and points behave exactly as on the
// Habits page; undo stays there.
export function usePlannerHabits() {
  const today     = todayStr()
  const weekStart = periodStart('week', today)

  const { data: habits, setData: setHabits } = useCachedQuery<HabitRow[]>(
    'planner:habits',
    (db, userId) => db
      .from('personality_habits')
      .select('id, habit_name, streak_count, last_done_at, frequency, is_global')
      .or(`user_id.eq.${userId},is_global.eq.true`)
      .order('created_at', { ascending: true }),
    [],
  )
  const { data: hidden } = useCachedQuery<{ habit_id: string }[]>(
    'hidden-global-habits',
    (db, userId) => db.from('user_hidden_habits').select('habit_id').eq('user_id', userId),
    [],
  )
  const { data: logs, setData: setLogs } = useCachedQuery<HabitLog[]>(
    `planner:habit-logs:${weekStart}:${today}`,
    (db, userId) => db
      .from('habit_logs')
      .select('habit_id, status, log_date')
      .eq('user_id', userId)
      .gte('log_date', weekStart)
      .lte('log_date', today),
    [],
    [weekStart, today],
  )
  const { inFlight: busy, begin, end } = useInFlightIds()
  const { celebrateMilestones } = useReward()

  const { daily, weekly } = useMemo(() => {
    const hiddenIds = new Set(hidden.map(h => h.habit_id))
    const visible = habits.filter(h => !h.is_global || !hiddenIds.has(h.id))
    const doneOn = (id: string, pred: (l: HabitLog) => boolean) =>
      logs.some(l => l.habit_id === id && l.status === 'done' && pred(l))
    // A non-'done' log today (skipped/missed) means the habit is not actionable.
    const skippedToday = (id: string) =>
      logs.some(l => l.habit_id === id && l.log_date === today && l.status !== 'done')
    const toPlanner = (h: HabitRow, done: boolean): PlannerHabit =>
      ({ id: h.id, habit_name: h.habit_name, streak_count: h.streak_count, frequency: h.frequency, done })
    return {
      daily: visible.filter(h => h.frequency !== 'weekly' && !skippedToday(h.id)).map(h => toPlanner(h,
        doneOn(h.id, l => l.log_date === today) ||
        // Same fallback as TodayHabits — never for globals (shared column).
        (!h.is_global && !!h.last_done_at && localDateStr(new Date(h.last_done_at)) === today))),
      weekly: visible.filter(h => h.frequency === 'weekly').map(h => toPlanner(h, doneOn(h.id, () => true))),
    }
  }, [habits, hidden, logs, today])

  async function markDone(h: PlannerHabit) {
    if (h.done) return
    if (h.frequency !== 'weekly' &&
        logs.some(l => l.habit_id === h.id && l.log_date === today && l.status !== 'done')) return
    if (!begin(h.id)) return
    setLogs(prev => [...prev, { habit_id: h.id, status: 'done', log_date: today }])
    try {
      const { streak_count, milestones } = await completeHabit(h.id)
      setHabits(prev => prev.map(x => (x.id === h.id
        ? { ...x, streak_count, last_done_at: new Date().toISOString() }
        : x)))
      celebrateMilestones(milestones)
    } catch {
      setLogs(prev => prev.filter(l => !(l.habit_id === h.id && l.log_date === today && l.status === 'done')))
    }
    end(h.id)
  }

  return { daily, weekly, busy, markDone }
}
