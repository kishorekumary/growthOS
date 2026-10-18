'use client'

import CountUp from '@/components/ui/count-up'
import StatTile from '@/components/ui/stat-tile'
import { useState } from 'react'
import { Loader2, TrendingUp, Flame, Clock, Dumbbell } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, startOfWeek, subWeeks } from 'date-fns'

interface WeightLog {
  id: string
  log_date: string
  weight_kg: number
}

interface WorkoutLog {
  id: string
  log_date: string
  workout_type: string
  duration_mins: number
}

function calcStreak(logs: WorkoutLog[]): number {
  const activeDates = new Set(
    logs.filter(l => l.workout_type !== 'rest').map(l => l.log_date)
  )
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    if (activeDates.has(dateStr)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function buildWeeklyData(logs: WorkoutLog[]) {
  const now = new Date()
  const weeks: { week: string; count: number }[] = []

  for (let w = 3; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 })
    const label = format(weekStart, 'MMM d')
    const count = logs.filter(l => {
      const d = new Date(l.log_date + 'T12:00:00')
      const ws = startOfWeek(d, { weekStartsOn: 1 })
      return ws.toISOString().split('T')[0] === weekStart.toISOString().split('T')[0]
        && l.workout_type !== 'rest'
    }).length
    weeks.push({ week: label, count })
  }
  return weeks
}

const TICK_STYLE = { fill: 'rgb(var(--c-slate-400))', fontSize: 11 }
const TOOLTIP_STYLE = {
  backgroundColor: 'rgb(var(--c-slate-900))',
  border: '1px solid rgb(var(--c-white) / 0.1)',
  borderRadius: 8,
  color: 'rgb(var(--c-slate-200))',
  fontSize: 12,
}

export default function FitnessProgress() {
  const [newWeight, setNewWeight]     = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  const {
    data: weightLogs,
    loading: weightLoading,
    isOffline: weightOffline,
    refetch: refetchWeightLogs,
  } = useCachedQuery<WeightLog[]>(
    'fitness:weight_logs',
    (supabase, userId) => supabase
      .from('weight_logs')
      .select('id, log_date, weight_kg')
      .eq('user_id', userId)
      .order('log_date', { ascending: true })
      .limit(30),
    []
  )

  const {
    data: workoutLogs,
    loading: workoutLoading,
    isOffline: workoutOffline,
  } = useCachedQuery<WorkoutLog[]>(
    'fitness:workout_logs',
    (supabase, userId) => supabase
      .from('workout_logs')
      .select('id, log_date, workout_type, duration_mins')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(200),
    []
  )

  const loading   = weightLoading || workoutLoading
  const isOffline = weightOffline || workoutOffline

  async function logWeight() {
    const w = parseFloat(newWeight)
    if (!w || isNaN(w)) return
    setSavingWeight(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSavingWeight(false); return }
    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('weight_logs')
      .upsert({ user_id: session.user.id, log_date: today, weight_kg: w }, { onConflict: 'user_id,log_date' })
    setNewWeight('')
    setSavingWeight(false)
    refetchWeightLogs()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const totalWorkouts = workoutLogs.filter(l => l.workout_type !== 'rest').length
  const totalMins     = workoutLogs.reduce((s, l) => s + (l.duration_mins ?? 0), 0)
  const streak        = calcStreak(workoutLogs)
  const weeklyData    = buildWeeklyData(workoutLogs)
  const weightData    = weightLogs.map(l => ({
    date: format(new Date(l.log_date + 'T12:00:00'), 'MMM d'),
    weight: Number(l.weight_kg),
  }))

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-white">Progress</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={Dumbbell} tone="violet" label="Workouts" value={<CountUp value={totalWorkouts} />} />
        <StatTile icon={Clock} tone="sky" label="Minutes" value={<CountUp value={totalMins} />} />
        <StatTile icon={Flame} tone="orange" label="Day streak" value={<CountUp value={streak} />} />
      </div>

      {/* Workouts per week */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <p className="text-sm font-medium text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" /> Workouts per week
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weeklyData} barSize={28}>
            <CartesianGrid vertical={false} stroke="rgb(var(--c-white) / 0.05)" />
            <XAxis dataKey="week" tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={TICK_STYLE} axisLine={false} tickLine={false} width={20} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgb(var(--c-white) / 0.04)' }} />
            <Bar dataKey="count" name="Workouts" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weight log */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <p className="text-sm font-medium text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-400" /> Weight progress (kg)
        </p>

        {weightData.length > 1 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weightData}>
              <CartesianGrid stroke="rgb(var(--c-white) / 0.05)" />
              <XAxis dataKey="date" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="weight"
                name="Weight (kg)"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={{ fill: '#a78bfa', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : weightData.length === 0 && isOffline ? (
          <p className="text-sm text-slate-500 text-center py-4">
            Can&apos;t load — you&apos;re offline.
          </p>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">
            Log at least 2 entries to see your chart.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Input
            type="number"
            step="0.1"
            min="20"
            max="300"
            placeholder="Today's weight (kg)"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') logWeight() }}
            className="flex-1 border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
          />
          <Button
            onClick={logWeight}
            disabled={savingWeight || !newWeight}
            className="bg-violet-600 hover:bg-violet-700 text-snow shrink-0"
          >
            {savingWeight ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log'}
          </Button>
        </div>
      </div>
    </div>
  )
}
