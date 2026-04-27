'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, TrendingUp, Flame, Clock, Dumbbell } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
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

const TICK_STYLE = { fill: '#94a3b8', fontSize: 11 }
const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

export default function FitnessProgress() {
  const [weightLogs, setWeightLogs]   = useState<WeightLog[]>([])
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading]         = useState(true)
  const [newWeight, setNewWeight]     = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const [{ data: wl }, { data: wkl }] = await Promise.all([
      supabase
        .from('weight_logs')
        .select('id, log_date, weight_kg')
        .eq('user_id', session.user.id)
        .order('log_date', { ascending: true })
        .limit(30),
      supabase
        .from('workout_logs')
        .select('id, log_date, workout_type, duration_mins')
        .eq('user_id', session.user.id)
        .order('log_date', { ascending: false })
        .limit(200),
    ])
    setWeightLogs(wl ?? [])
    setWorkoutLogs(wkl ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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
    fetchData()
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
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <Dumbbell className="h-4 w-4 text-violet-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{totalWorkouts}</p>
          <p className="text-xs text-slate-500">Workouts</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <Clock className="h-4 w-4 text-sky-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{totalMins}</p>
          <p className="text-xs text-slate-500">Minutes</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <Flame className="h-4 w-4 text-orange-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{streak}</p>
          <p className="text-xs text-slate-500">Day streak</p>
        </div>
      </div>

      {/* Workouts per week */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <p className="text-sm font-medium text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" /> Workouts per week
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weeklyData} barSize={28}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="week" tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={TICK_STYLE} axisLine={false} tickLine={false} width={20} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
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
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
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
            className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
          >
            {savingWeight ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log'}
          </Button>
        </div>
      </div>
    </div>
  )
}
