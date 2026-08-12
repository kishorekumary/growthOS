'use client'

import { useState } from 'react'
import { Flame, CheckCircle2, ChevronLeft, Sparkles, Loader2, Trophy, Lock, Pencil } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { format, parseISO, differenceInDays, addDays, subDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Challenge {
  id: string
  title: string
  description: string | null
  category: string
  start_date: string
  duration_days: number
  daily_commitment: string | null
  why_matters: string | null
  status: 'active' | 'completed' | 'abandoned'
  created_at: string
}

const CATEGORIES = [
  { value: 'fitness',  label: '💪 Fitness'  },
  { value: 'learning', label: '📚 Learning' },
  { value: 'habits',   label: '🔁 Habits'   },
  { value: 'career',   label: '💼 Career'   },
  { value: 'health',   label: '🌿 Health'   },
  { value: 'personal', label: '🧠 Personal' },
  { value: 'creative', label: '🎨 Creative' },
]

interface Checkin {
  checkin_date: string
  completed: boolean
  reflection: string | null
}

interface Props {
  challenge: Challenge
  onBack: () => void
  onComplete: (id: string) => void
  onUpdate: (challenge: Challenge) => void
}

const CATEGORY_COLOR: Record<string, string> = {
  fitness: '#ef4444', learning: '#a78bfa', habits: '#f59e0b',
  career: '#3b82f6', health: '#22c55e', personal: '#818cf8', creative: '#f472b6',
}

// Preserve the original hand-picked milestones for the default 90-day case;
// derive proportional checkpoints for any other custom duration.
function computeMilestones(totalDays: number): number[] {
  if (totalDays === 90) return [7, 21, 30, 45, 60, 75, 90]
  const days = [0.1, 0.25, 0.5, 0.75, 1].map(f => Math.max(1, Math.round(totalDays * f)))
  return Array.from(new Set(days)).sort((a, b) => a - b)
}

function ProgressRing({ day, totalDays }: { day: number; totalDays: number }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const pct = Math.min(day / totalDays, 1)
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
        <div className="text-2xl font-black text-white leading-none">{Math.min(day, totalDays)}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">of {totalDays}</div>
      </div>
    </div>
  )
}

export default function ChallengeDetail({ challenge, onBack, onComplete, onUpdate }: Props) {
  const supabase = createSupabaseBrowserClient()
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null)
  const [milestoneLoading, setMilestoneLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [checkinError, setCheckinError] = useState<string | null>(null)

  const { data: checkins, isOffline, refetch: load } = useCachedQuery<Record<string, Checkin>>(
    `challenge-checkins:${challenge.id}`,
    (supabase, userId) => supabase
      .from('challenge_checkins')
      .select('checkin_date,completed,reflection')
      .eq('challenge_id', challenge.id)
      .then(({ data, error }) => ({
        data: data ? Object.fromEntries(data.map(c => [c.checkin_date, c])) : null,
        error,
      })),
    {},
    [challenge.id]
  )

  const totalDays  = challenge.duration_days
  const MILESTONES = computeMilestones(totalDays)
  const today      = format(new Date(), 'yyyy-MM-dd')
  const startDate  = parseISO(challenge.start_date)
  const dayNumber  = Math.max(1, Math.min(differenceInDays(new Date(), startDate) + 1, totalDays))
  // Gated on status === 'active' so an abandoned or already-completed challenge
  // can't be silently revived by checking in again — without this, the clamped
  // dayNumber above never exceeds totalDays, so date math alone would keep
  // showing a live check-in card indefinitely after the challenge is over.
  const isTodayInRange = challenge.status === 'active' && dayNumber >= 1 && dayNumber <= totalDays && challenge.start_date <= today
  const todayCheckin   = checkins[today]
  const isMilestoneDay = MILESTONES.includes(dayNumber)
  const phase = dayNumber <= totalDays / 3 ? 'Foundation' : dayNumber <= totalDays * 2 / 3 ? 'Momentum' : 'Mastery'

  const catColor = CATEGORY_COLOR[challenge.category] ?? '#818cf8'

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

  function dayNumberForDate(dateStr: string) {
    return differenceInDays(parseISO(dateStr), startDate) + 1
  }

  // A day can be marked/unmarked/edited if it's not in the future, it's
  // within 3 days of today (a grace window for catching up on missed days),
  // and it falls within the challenge's actual day range. Independent of
  // challenge.status so it behaves the same for active/abandoned/completed.
  function isEditableDate(dateStr: string) {
    if (dateStr > today) return false
    if (differenceInDays(parseISO(today), parseISO(dateStr)) > 3) return false
    const dn = dayNumberForDate(dateStr)
    return dn >= 1 && dn <= totalDays
  }

  async function saveCheckin(date: string, completed: boolean, reflectionText: string): Promise<boolean> {
    setCheckinError(null)
    if (saving || !isEditableDate(date)) return false
    setSaving(true)
    if (completed) {
      const { error } = await supabase.from('challenge_checkins').upsert({
        challenge_id: challenge.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        checkin_date: date,
        completed: true,
        reflection: reflectionText.trim() || null,
      }, { onConflict: 'challenge_id,checkin_date' })
      if (error) {
        setSaving(false)
        setCheckinError(error.message)
        return false
      }
    } else {
      const { error } = await supabase.from('challenge_checkins')
        .delete()
        .eq('challenge_id', challenge.id)
        .eq('checkin_date', date)
      if (error) {
        setSaving(false)
        setCheckinError(error.message)
        return false
      }
    }

    // Auto-complete the challenge if the edited day is the final day — keyed
    // off the edited date, not "today", so backfilling day `totalDays` within
    // the grace window fixes an abandoned challenge by completing it.
    if (completed && dayNumberForDate(date) >= totalDays) {
      await supabase
        .from('ninety_day_challenges')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', challenge.id)
      onComplete(challenge.id)
    }

    await load()
    setSaving(false)
    return true
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
          className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
          style={{ backgroundColor: catColor + '25', color: catColor }}
        >
          {challenge.category}
        </span>
        <span className="text-xs text-slate-500">{phase} Phase</span>
        <button
          onClick={() => setEditOpen(true)}
          className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      </div>

      {editOpen && (
        <EditChallengeModal
          challenge={challenge}
          onClose={() => setEditOpen(false)}
          onSaved={updated => { onUpdate(updated); setEditOpen(false) }}
        />
      )}

      {editingDate && (
        <DayEditModal
          date={editingDate}
          dayNumber={dayNumberForDate(editingDate)}
          checkin={checkins[editingDate]}
          saving={saving}
          onSave={async (completed, reflectionText) => {
            const ok = await saveCheckin(editingDate, completed, reflectionText)
            if (ok) setEditingDate(null)
          }}
          onClose={() => setEditingDate(null)}
        />
      )}

      {isOffline && (
        <p className="text-xs text-amber-400">Can&apos;t sync check-ins — you&apos;re offline.</p>
      )}

      {checkinError && (
        <p className="text-xs text-red-400">{checkinError}</p>
      )}

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
          <ProgressRing day={dayNumber} totalDays={totalDays} />
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400">{totalDays}-Day Map</p>
          <div className="flex items-center gap-3 text-[10px] text-slate-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: catColor + '99' }} />done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/20 inline-block" />missed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/5 inline-block" />ahead</span>
          </div>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
          {Array.from({ length: totalDays }, (_, i) => {
            const dateStr = format(addDays(startDate, i), 'yyyy-MM-dd')
            const isFuture = dateStr > today
            const isToday  = dateStr === today
            const isDone   = checkins[dateStr]?.completed
            const isMilestone = MILESTONES.includes(i + 1)
            const editable = isEditableDate(dateStr)

            let bg = 'bg-white/5'
            let style: React.CSSProperties | undefined
            if (isDone) { style = { backgroundColor: catColor + '99' }; bg = '' }
            else if (!isFuture && !isToday) bg = 'bg-red-500/15'

            return (
              <button
                key={i}
                type="button"
                title={`Day ${i + 1} · ${dateStr}`}
                aria-label={`Day ${i + 1}, ${dateStr}, ${isDone ? 'complete' : isFuture ? 'upcoming' : 'not complete'}`}
                onClick={editable ? () => setEditingDate(dateStr) : undefined}
                disabled={!editable}
                className={`aspect-square w-full rounded-sm transition-all ${bg} ${
                  isToday && !isDone ? 'ring-1 ring-white/40' : ''
                } ${isMilestone && !isDone && !isFuture ? 'ring-1 ring-yellow-500/40' : ''} ${
                  editable ? 'cursor-pointer hover:ring-1 hover:ring-white/50' : 'cursor-default'
                }`}
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
              {dayNumber === totalDays ? '🎉 Challenge Complete!' : `Day ${dayNumber} Milestone!`}
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
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-400">Day {dayNumber} complete!</p>
                {todayCheckin.reflection && (
                  <p className="text-xs text-slate-500 mt-0.5 italic">"{todayCheckin.reflection}"</p>
                )}
              </div>
              <button
                onClick={() => saveCheckin(today, false, '')}
                disabled={saving}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors underline decoration-dotted disabled:opacity-50"
              >
                Undo
              </button>
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
                onClick={async () => { const ok = await saveCheckin(today, true, reflection); if (ok) setReflection('') }}
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

// ─── Edit Challenge Modal ───────────────────────────────────────

function EditChallengeModal({ challenge, onClose, onSaved }: {
  challenge: Challenge
  onClose: () => void
  onSaved: (updated: Challenge) => void
}) {
  const [title, setTitle]                 = useState(challenge.title)
  const [category, setCategory]           = useState(challenge.category)
  const [startDate, setStartDate]         = useState(challenge.start_date)
  const [durationDays, setDurationDays]   = useState(challenge.duration_days)
  const [dailyCommitment, setDailyCommitment] = useState(challenge.daily_commitment ?? '')
  const [whyMatters, setWhyMatters]       = useState(challenge.why_matters ?? '')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data, error: updateError } = await supabase
      .from('ninety_day_challenges')
      .update({
        title: title.trim(),
        category,
        start_date: startDate,
        duration_days: durationDays,
        daily_commitment: dailyCommitment.trim() || null,
        why_matters: whyMatters.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', challenge.id)
      .select()
      .single()
    if (updateError) { setError(updateError.message); setSaving(false); return }
    setSaving(false)
    onSaved(data as Challenge)
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Challenge</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-challenge-title" className="text-slate-300">Challenge title</Label>
            <Input
              id="edit-challenge-title" autoFocus
              value={title} onChange={e => setTitle(e.target.value)}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Category</Label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className={cn('rounded-lg border py-2 px-2 text-xs font-medium transition-all',
                    category === c.value
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-challenge-start" className="text-slate-300">Start date</Label>
              <input
                id="edit-challenge-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-challenge-duration" className="text-slate-300">Duration (days)</Label>
              <Input
                id="edit-challenge-duration"
                type="number" min={1}
                value={durationDays}
                onChange={e => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="border-white/20 bg-white/5 text-white focus-visible:ring-purple-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-challenge-commitment" className="text-slate-300">Daily commitment</Label>
            <Input
              id="edit-challenge-commitment"
              value={dailyCommitment} onChange={e => setDailyCommitment(e.target.value)}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-challenge-why" className="text-slate-300">Why does this matter to you?</Label>
            <textarea
              id="edit-challenge-why"
              value={whyMatters}
              onChange={e => setWhyMatters(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Day Edit Modal ─────────────────────────────────────────────

function DayEditModal({ date, dayNumber, checkin, saving, onSave, onClose }: {
  date: string
  dayNumber: number
  checkin: Checkin | undefined
  saving: boolean
  onSave: (completed: boolean, reflection: string) => Promise<void>
  onClose: () => void
}) {
  const [reflection, setReflection] = useState(checkin?.reflection ?? '')

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Day {dayNumber} · {format(parseISO(date), 'MMM d')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <textarea
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="Quick reflection (optional)…"
            rows={3}
            className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-purple-500/40 resize-none"
          />
          <div className="flex gap-2">
            {checkin?.completed ? (
              <>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={saving}
                  onClick={() => onSave(true, reflection)}
                >
                  Save reflection
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 text-slate-300"
                  disabled={saving}
                  onClick={() => onSave(false, reflection)}
                >
                  Mark incomplete
                </Button>
              </>
            ) : (
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={saving}
                onClick={() => onSave(true, reflection)}
              >
                Mark complete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
