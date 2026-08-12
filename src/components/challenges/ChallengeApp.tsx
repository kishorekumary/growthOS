'use client'

import { useState, useEffect } from 'react'
import { Plus, Flame, ChevronRight, X, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { format, parseISO, differenceInDays, addDays } from 'date-fns'
import ChallengeDetail from './ChallengeDetail'

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

const DURATION_PRESETS = [21, 30, 60, 90, 180, 365]

const CATEGORY_COLOR: Record<string, string> = {
  fitness: '#ef4444', learning: '#a78bfa', habits: '#f59e0b',
  career: '#3b82f6', health: '#22c55e', personal: '#818cf8', creative: '#f472b6',
}

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
)

// A challenge's days have run out once its raw (unclamped) day number passes
// duration_days. Used both to keep expired-but-never-completed challenges out
// of the Active list and to detect which ones need to transition to
// 'abandoned' — single source of truth so the two never drift apart.
function isChallengeExpired(challenge: Challenge): boolean {
  const rawDayNumber = differenceInDays(new Date(), parseISO(challenge.start_date)) + 1
  return rawDayNumber > challenge.duration_days
}

function ChallengeCard({ challenge, onClick }: { challenge: Challenge; onClick: () => void }) {
  const today       = format(new Date(), 'yyyy-MM-dd')
  const startDate   = parseISO(challenge.start_date)
  const totalDays   = challenge.duration_days
  const dayNumber   = Math.max(0, Math.min(differenceInDays(new Date(), startDate) + 1, totalDays))
  const pct         = Math.round(dayNumber / totalDays * 100)
  const catColor    = CATEGORY_COLOR[challenge.category] ?? '#818cf8'
  const isCompleted = challenge.status === 'completed'
  const isAbandoned = challenge.status === 'abandoned' || (challenge.status === 'active' && isChallengeExpired(challenge))
  const isDull      = isCompleted || isAbandoned
  const notStarted  = challenge.start_date > today

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-white/8 bg-white/3 p-4 hover:border-white/15 hover:bg-white/5 transition-all group ${isDull ? 'opacity-55' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
              style={{ backgroundColor: catColor + '20', color: catColor }}>
              {challenge.category}
            </span>
            {isCompleted && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Completed</span>}
            {isAbandoned && <span className="text-[10px] text-red-400/70 bg-red-500/10 px-1.5 py-0.5 rounded">Abandoned</span>}
            {notStarted && <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">Starts {challenge.start_date}</span>}
          </div>
          <p className="text-sm font-semibold text-white truncate">{challenge.title}</p>
          {challenge.daily_commitment && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{challenge.daily_commitment}</p>
          )}
        </div>
        <div className="text-center shrink-0">
          <div className="text-xl font-black text-white">{notStarted ? 0 : dayNumber}</div>
          <div className="text-[10px] text-slate-500">/ {totalDays}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: catColor }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-slate-600">{pct}% complete</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    </button>
  )
}

export default function ChallengeApp() {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [selected, setSelected] = useState<Challenge | null>(null)
  const [saving, setSaving] = useState(false)

  // form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('personal')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [durationDays, setDurationDays] = useState(90)
  const [dailyCommitment, setDailyCommitment] = useState('')
  const [whyMatters, setWhyMatters] = useState('')
  const [description, setDescription] = useState('')

  const { data: challenges, loading, isOffline, refetch: load, setData: setChallenges } = useCachedQuery<Challenge[]>(
    'ninety-day-challenges',
    (supabase, userId) => supabase
      .from('ninety_day_challenges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    []
  )

  async function createChallenge() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    const { data } = await supabase
      .from('ninety_day_challenges')
      .insert({
        user_id: session.user.id,
        title: title.trim(),
        category,
        start_date: startDate,
        duration_days: durationDays,
        daily_commitment: dailyCommitment.trim() || null,
        why_matters: whyMatters.trim() || null,
        description: description.trim() || null,
      })
      .select()
      .single()
    setSaving(false)
    if (data) {
      load()
      setSelected(data)
      setView('detail')
      resetForm()
    }
  }

  function resetForm() {
    setTitle(''); setCategory('personal')
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setDurationDays(90)
    setDailyCommitment(''); setWhyMatters(''); setDescription('')
  }

  function handleComplete(id: string) {
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, status: 'completed' as const } : c))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: 'completed' } : null)
  }

  function handleUpdate(updated: Challenge) {
    setChallenges(prev => prev.map(c => c.id === updated.id ? updated : c))
    if (selected?.id === updated.id) setSelected(updated)
  }

  // Nothing ever flips status away from 'active' on its own — completion only
  // happens if the user checks in on/after the final day (ChallengeDetail).
  // A challenge whose days simply ran out with no final check-in would stay
  // 'active' forever. Persist the transition to 'abandoned' here; the bucket
  // filters below also treat it as abandoned immediately (optimistically),
  // so it never has to wait on this write to disappear from Active.
  useEffect(() => {
    const toAbandon = challenges.filter(c => c.status === 'active' && isChallengeExpired(c))
    if (toAbandon.length === 0) return
    const ids = toAbandon.map(c => c.id)
    setChallenges(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: 'abandoned' as const } : c))
    const supabase = createSupabaseBrowserClient()
    supabase.from('ninety_day_challenges')
      .update({ status: 'abandoned', updated_at: new Date().toISOString() })
      .in('id', ids)
      .then()
  }, [challenges, setChallenges])

  const active    = challenges.filter(c => c.status === 'active' && !isChallengeExpired(c))
  const completed = challenges.filter(c => c.status === 'completed')
  const abandoned = challenges.filter(c => c.status === 'abandoned' || (c.status === 'active' && isChallengeExpired(c)))

  if (view === 'detail' && selected) {
    return (
      <ChallengeDetail
        challenge={selected}
        onBack={() => setView('list')}
        onComplete={handleComplete}
        onUpdate={handleUpdate}
      />
    )
  }

  if (view === 'create') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">New Challenge</h2>
          <button onClick={() => { setView('list'); resetForm() }} className="text-slate-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Challenge title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Run every morning for 90 days"
              className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/40"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`rounded-xl border py-2 text-xs font-medium transition-all ${
                    category === c.value
                      ? 'text-white border-white/20 bg-white/10'
                      : 'text-slate-500 border-white/5 bg-white/2 hover:border-white/10 hover:text-slate-400'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/40 [color-scheme:dark]"
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_PRESETS.map(d => (
                <button
                  key={d}
                  onClick={() => setDurationDays(d)}
                  className={`rounded-xl border py-2 text-xs font-medium transition-all ${
                    durationDays === d
                      ? 'text-white border-white/20 bg-white/10'
                      : 'text-slate-500 border-white/5 bg-white/2 hover:border-white/10 hover:text-slate-400'
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-slate-600">Custom:</span>
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={e => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500/40"
              />
              <span className="text-xs text-slate-600">days</span>
            </div>
          </div>

          {/* Daily commitment */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Daily commitment</label>
            <input
              value={dailyCommitment}
              onChange={e => setDailyCommitment(e.target.value)}
              placeholder="Each day I will…"
              className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/40"
            />
          </div>

          {/* Why it matters */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Why does this matter to you?</label>
            <textarea
              value={whyMatters}
              onChange={e => setWhyMatters(e.target.value)}
              placeholder="This challenge matters because…"
              rows={3}
              className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/40 resize-none"
            />
          </div>

          <button
            onClick={createChallenge}
            disabled={saving || !title.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 py-3 text-sm font-semibold text-white transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
            {saving ? 'Starting challenge…' : `Start ${durationDays}-Day Challenge`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Start new */}
      <button
        onClick={() => setView('create')}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-4 text-sm text-slate-500 hover:border-purple-500/40 hover:text-purple-400 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Start a new challenge
      </button>

      {/* Active */}
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide px-1">Active</p>
          {active.map(c => (
            <ChallengeCard key={c.id} challenge={c} onClick={() => { setSelected(c); setView('detail') }} />
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide px-1">Completed 🏆</p>
          {completed.map(c => (
            <ChallengeCard key={c.id} challenge={c} onClick={() => { setSelected(c); setView('detail') }} />
          ))}
        </div>
      )}

      {/* Abandoned — days ran out without a final check-in */}
      {abandoned.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide px-1">Abandoned</p>
          {abandoned.map(c => (
            <ChallengeCard key={c.id} challenge={c} onClick={() => { setSelected(c); setView('detail') }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {challenges.length === 0 && isOffline && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-10 text-center space-y-2">
          <div className="text-4xl">📡</div>
          <p className="text-sm text-slate-500">Can&apos;t load challenges — you&apos;re offline.</p>
        </div>
      )}

      {challenges.length === 0 && !isOffline && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-10 text-center space-y-3">
          <div className="text-4xl">🔥</div>
          <p className="text-base font-semibold text-white">Transform your life, one challenge at a time</p>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Pick one commitment, choose your timeframe, show up every day, and watch compound growth change everything.
          </p>
          <button
            onClick={() => setView('create')}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            <Flame className="h-4 w-4" />
            Start your first challenge
          </button>
        </div>
      )}
    </div>
  )
}
