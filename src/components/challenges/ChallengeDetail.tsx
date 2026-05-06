'use client'

import { useState, useEffect, useCallback } from 'react'
import { Flame, CheckCircle2, ChevronLeft, Sparkles, Loader2, Trophy, Lock } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { format, parseISO, differenceInDays, addDays, subDays } from 'date-fns'

interface Challenge {
  id: string
  title: string
  description: string | null
  category: string
  start_date: string
  daily_commitment: string | null
  why_matters: string | null
  status: 'active' | 'completed' | 'abandoned'
}

interface Checkin {
  checkin_date: string
  completed: boolean
  reflection: string | null
}

interface Props {
  challenge: Challenge
  onBack: () => void
  onComplete: (id: string) => void
}

const CATEGORY_COLOR: Record<string, string> = {
  fitness: '#ef4444', learning: '#a78bfa', habits: '#f59e0b',
  career: '#3b82f6', health: '#22c55e', personal: '#818cf8', creative: '#f472b6',
}

const MILESTONES = [7, 21, 30, 45, 60, 75, 90]

function ProgressRing({ day }: { day: number }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const pct = Math.min(day / 90, 1)
  const dash = circ * pct
  return (
    <div className="relative flex items-center justify-center w-24 h-24 shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke="#a78bfa" strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-black text-white leading-none">{Math.min(day, 90)}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">of 90</div>
      </div>
    </div>
  )
}

export default function ChallengeDetail({ challenge, onBack, onComplete }: Props) {
  const supabase = createSupabaseBrowserClient()
  const [checkins, setCheckins] = useState<Record<string, Checkin>>({})
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null)
  const [milestoneLoading, setMilestoneLoading] = useState(false)

  const today      = format(new Date(), 'yyyy-MM-dd')
  const startDate  = parseISO(challenge.start_date)
  const dayNumber  = Math.max(1, Math.min(differenceInDays(new Date(), startDate) + 1, 90))
  const isTodayInRange = dayNumber >= 1 && dayNumber <= 90 && challenge.start_date <= today
  const todayCheckin   = checkins[today]
  const isMilestoneDay = MILESTONES.includes(dayNumber)
  const phase = dayNumber <= 30 ? 'Foundation' : dayNumber <= 60 ? 'Momentum' : 'Mastery'

  const catColor = CATEGORY_COLOR[challenge.category] ?? '#818cf8'

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('challenge_checkins')
      .select('checkin_date,completed,reflection')
      .eq('challenge_id', challenge.id)
    if (data) {
      setCheckins(Object.fromEntries(data.map(c => [c.checkin_date, c])))
    }
  }, [supabase, challenge.id])

  useEffect(() => { load() }, [load])

  const completedCount = Object.values(checkins).filter(c => c.completed).length

  // Streak calculation
  let streak = 0
  let d = new Date()
  if (!checkins[today]?.completed) d = subDays(d, 1)
  for (let i = 0; i < dayNumber; i++) {
    const key = format(d, 'yyyy-MM-dd')
    if (!checkins[key]?.completed) break
    streak++
    d = subDays(d, 1)
  }

  async function checkIn() {
    if (!isTodayInRange || saving) return
    setSaving(true)
    await supabase.from('challenge_checkins').upsert({
      challenge_id: challenge.id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      checkin_date: today,
      completed: true,
      reflection: reflection.trim() || null,
    }, { onConflict: 'challenge_id,checkin_date' })

    // Auto-complete challenge on day 90
    if (dayNumber >= 90) {
      await supabase
        .from('ninety_day_challenges')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', challenge.id)
      onComplete(challenge.id)
    }

    await load()
    setReflection('')
    setSaving(false)
  }

  async function loadAiPrompt() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/challenge-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id, type: 'daily' }),
      })
      const json = await res.json()
      setAiMessage(json.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function loadMilestone() {
    setMilestoneLoading(true)
    try {
      const res = await fetch('/api/ai/challenge-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id, type: 'milestone' }),
      })
      const json = await res.json()
      setMilestoneMsg(json.message)
    } finally {
      setMilestoneLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium capitalize"
          style={{ backgroundColor: catColor + '25', color: catColor }}
        >
          {challenge.category}
        </span>
        <span className="text-xs text-slate-500">{phase} Phase</span>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white mb-1">{challenge.title}</h2>
            {challenge.daily_commitment && (
              <p className="text-xs text-slate-500 mb-3">
                Daily: <span className="text-slate-400">{challenge.daily_commitment}</span>
              </p>
            )}
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-white">{completedCount}</div>
                <div className="text-[10px] text-slate-500">done</div>
              </div>
              <div className="text-center">
                <div className="font-bold flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-white">{streak}</span>
                </div>
                <div className="text-[10px] text-slate-500">streak</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-white">{Math.round(completedCount / Math.max(dayNumber - 1, 1) * 100)}%</div>
                <div className="text-[10px] text-slate-500">rate</div>
              </div>
            </div>
          </div>
          <ProgressRing day={dayNumber} />
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400">90-Day Map</p>
          <div className="flex items-center gap-3 text-[10px] text-slate-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: catColor + '99' }} />done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/20 inline-block" />missed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/5 inline-block" />ahead</span>
          </div>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
          {Array.from({ length: 90 }, (_, i) => {
            const dateStr = format(addDays(startDate, i), 'yyyy-MM-dd')
            const isFuture = dateStr > today
            const isToday  = dateStr === today
            const isDone   = checkins[dateStr]?.completed
            const isMilestone = MILESTONES.includes(i + 1)

            let bg = 'bg-white/5'
            let style: React.CSSProperties | undefined
            if (isDone) { style = { backgroundColor: catColor + '99' }; bg = '' }
            else if (!isFuture && !isToday) bg = 'bg-red-500/15'

            return (
              <div
                key={i}
                title={`Day ${i + 1} · ${dateStr}`}
                className={`aspect-square rounded-sm transition-all ${bg} ${
                  isToday && !isDone ? 'ring-1 ring-white/40' : ''
                } ${isMilestone && !isDone && !isFuture ? 'ring-1 ring-yellow-500/40' : ''}`}
                style={style}
              />
            )
          })}
        </div>
        <div className="flex gap-2 flex-wrap">
          {MILESTONES.map(m => (
            <span key={m} className={`text-[10px] px-1.5 py-0.5 rounded ${dayNumber >= m ? 'text-yellow-400 bg-yellow-500/10' : 'text-slate-600 bg-white/3'}`}>
              Day {m}
            </span>
          ))}
        </div>
      </div>

      {/* Milestone banner */}
      {isMilestoneDay && (
        <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/8 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400">
              {dayNumber === 90 ? '🎉 Challenge Complete!' : `Day ${dayNumber} Milestone!`}
            </span>
          </div>
          {milestoneMsg ? (
            <p className="text-sm text-slate-300 leading-relaxed">{milestoneMsg}</p>
          ) : (
            <button
              onClick={loadMilestone}
              disabled={milestoneLoading}
              className="flex items-center gap-2 text-xs text-yellow-400/80 hover:text-yellow-400 transition-colors"
            >
              {milestoneLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Get milestone message from coach
            </button>
          )}
        </div>
      )}

      {/* Today's check-in */}
      {isTodayInRange && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
          {todayCheckin?.completed ? (
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Day {dayNumber} complete!</p>
                {todayCheckin.reflection && (
                  <p className="text-xs text-slate-500 mt-0.5 italic">"{todayCheckin.reflection}"</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Day {dayNumber} Check-in</p>
              {challenge.daily_commitment && (
                <p className="text-xs text-slate-500">Today: <span className="text-slate-400">{challenge.daily_commitment}</span></p>
              )}
              <textarea
                value={reflection}
                onChange={e => setReflection(e.target.value)}
                placeholder="Quick reflection (optional)…"
                rows={2}
                className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-purple-500/40 resize-none"
              />
              <button
                onClick={checkIn}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: catColor + 'cc' }}
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? 'Saving…' : 'Mark day complete'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Daily AI prompt */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Coach Message</span>
          </div>
          <button
            onClick={loadAiPrompt}
            disabled={aiLoading}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {aiMessage ? 'Refresh' : 'Get message'}
          </button>
        </div>
        {aiMessage ? (
          <p className="text-sm text-slate-300 leading-relaxed">{aiMessage}</p>
        ) : (
          <p className="text-xs text-slate-600">Get a personalized message from your AI coach for today.</p>
        )}
      </div>

      {/* Why this matters */}
      {challenge.why_matters && (
        <div className="rounded-2xl border border-white/5 bg-white/2 px-4 py-3">
          <p className="text-[11px] text-slate-600 font-medium mb-1">Why this matters</p>
          <p className="text-sm text-slate-400 italic">"{challenge.why_matters}"</p>
        </div>
      )}
    </div>
  )
}
