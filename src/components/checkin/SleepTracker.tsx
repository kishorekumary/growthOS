'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Moon, CheckCircle, RefreshCw, TrendingUp } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { format, subDays } from 'date-fns'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface SleepLog {
  id: string
  sleep_date: string
  bedtime: string
  wake_time: string
  quality: number | null
  notes: string | null
}

const QUALITY_LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Perfect']
const QUALITY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4']

function sleepHours(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)
  let mins = (wh * 60 + wm) - (bh * 60 + bm)
  if (mins < 0) mins += 24 * 60
  return Math.round((mins / 60) * 10) / 10
}

export default function SleepTracker() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [existing, setExisting]   = useState<SleepLog | null>(null)
  const [history, setHistory]     = useState<SleepLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [editing, setEditing]     = useState(false)

  const [bedtime,  setBedtime]  = useState('22:30')
  const [wakeTime, setWakeTime] = useState('06:30')
  const [quality,  setQuality]  = useState(0)
  const [notes,    setNotes]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const since = format(subDays(new Date(), 13), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('sleep_logs')
      .select('*')
      .gte('sleep_date', since)
      .order('sleep_date', { ascending: true })

    const logs = (data ?? []) as SleepLog[]
    setHistory(logs)
    const todayLog = logs.find(l => l.sleep_date === today)
    if (todayLog) {
      setExisting(todayLog)
      setBedtime(todayLog.bedtime.slice(0, 5))
      setWakeTime(todayLog.wake_time.slice(0, 5))
      setQuality(todayLog.quality ?? 0)
      setNotes(todayLog.notes ?? '')
    }
    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  async function submit() {
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('sleep_logs').upsert({
      user_id: user.id,
      sleep_date: today,
      bedtime, wake_time: wakeTime,
      quality: quality || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,sleep_date' })
    setSaving(false)
    setEditing(false)
    load()
  }

  const chartData = history.map(l => ({
    date: format(new Date(l.sleep_date + 'T00:00:00'), 'MM/dd'),
    hours: sleepHours(l.bedtime.slice(0, 5), l.wake_time.slice(0, 5)),
    quality: l.quality ?? 0,
  }))

  const avgHours = history.length
    ? Math.round((history.reduce((s, l) => s + sleepHours(l.bedtime.slice(0, 5), l.wake_time.slice(0, 5)), 0) / history.length) * 10) / 10
    : 0

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Log form */}
      {existing && !editing ? (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-indigo-400" />
              <p className="text-sm font-semibold text-white">Sleep Logged</p>
            </div>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors">
              <RefreshCw className="h-3 w-3" /> Edit
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <p className="text-xs text-slate-500">Bedtime</p>
              <p className="text-lg font-bold text-white mt-1">{existing.bedtime.slice(0, 5)}</p>
            </div>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
              <p className="text-xs text-slate-500">Hours</p>
              <p className="text-lg font-bold text-indigo-300 mt-1">{sleepHours(existing.bedtime.slice(0, 5), existing.wake_time.slice(0, 5))}h</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <p className="text-xs text-slate-500">Wake</p>
              <p className="text-lg font-bold text-white mt-1">{existing.wake_time.slice(0, 5)}</p>
            </div>
          </div>
          {existing.quality && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Quality:</span>
              <span className="text-xs font-medium" style={{ color: QUALITY_COLORS[existing.quality - 1] }}>
                {QUALITY_LABELS[existing.quality - 1]}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20">
              <Moon className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Log Last Night's Sleep</p>
              <p className="text-xs text-slate-500">Track your rest to unlock insights</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Bedtime</label>
              <input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Wake time</label>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>

          {bedtime && wakeTime && (
            <p className="text-xs text-indigo-300 font-medium">
              ≈ {sleepHours(bedtime, wakeTime)} hours of sleep
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400">Quality</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setQuality(quality === n ? 0 : n)}
                  className={cn(
                    'flex-1 h-9 rounded-lg border text-xs font-medium transition-all',
                    quality === n ? 'border-transparent text-white' : 'border-white/10 bg-white/5 text-slate-500 hover:border-white/20'
                  )}
                  style={quality === n ? { background: QUALITY_COLORS[n-1] + '33', borderColor: QUALITY_COLORS[n-1] + '88', color: QUALITY_COLORS[n-1] } : {}}
                >
                  {QUALITY_LABELS[n - 1]}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes about your sleep?"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />

          <button onClick={submit} disabled={saving}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 py-2.5 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Log Sleep'}
          </button>
        </div>
      )}

      {/* 14-day chart */}
      {chartData.length > 1 && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              <p className="text-sm font-semibold text-white">Sleep Trend</p>
            </div>
            <span className="text-xs text-slate-500">Avg {avgHours}h / night</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 12]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [`${v}h`, 'Sleep']}
              />
              <Area type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={2} fill="url(#sleepGrad)" dot={{ fill: '#6366f1', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-2 text-xs">
            <span className="text-slate-500">Recommended: </span>
            <span className={cn('font-medium', avgHours >= 7 ? 'text-emerald-400' : 'text-amber-400')}>
              {avgHours >= 7 ? `You're averaging ${avgHours}h ✓` : `${avgHours}h — aim for 7-9h`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
