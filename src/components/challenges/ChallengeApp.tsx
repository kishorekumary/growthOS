'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Flame, ChevronRight, X, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { format, parseISO, differenceInDays, addDays } from 'date-fns'
import ChallengeDetail from './ChallengeDetail'

interface Challenge {
  id: string
  title: string
  description: string | null
  category: string
  start_date: string
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

const CATEGORY_COLOR: Record<string, string> = {
  fitness: '#ef4444', learning: '#a78bfa', habits: '#f59e0b',
  career: '#3b82f6', health: '#22c55e', personal: '#818cf8', creative: '#f472b6',
}

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
)

function ChallengeCard({ challenge, onClick }: { challenge: Challenge; onClick: () => void }) {
  const today       = format(new Date(), 'yyyy-MM-dd')
  const startDate   = parseISO(challenge.start_date)
  const dayNumber   = Math.max(0, Math.min(differenceInDays(new Date(), startDate) + 1, 90))
  const pct         = Math.round(dayNumber / 90 * 100)
  const catColor    = CATEGORY_COLOR[challenge.category] ?? '#818cf8'
  const isCompleted = challenge.status === 'completed'
  const notStarted  = challenge.start_date > today

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-white/8 bg-white/3 p-4 hover:border-white/15 hover:bg-white/5 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
              style={{ backgroundColor: catColor + '20', color: catColor }}>
              {challenge.category}
            </span>
            {isCompleted && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Completed</span>}
            {notStarted && <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">Starts {challenge.start_date}</span>}
          </div>
          <p className="text-sm font-semibold text-white truncate">{challenge.title}</p>
          {challenge.daily_commitment && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{challenge.daily_commitment}</p>
          )}
        </div>
        <div className="text-center shrink-0">
          <div className="text-xl font-black text-white">{notStarted ? 0 : dayNumber}</div>
          <div className="text-[10px] text-slate-500">/ 90</div>
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
  const supabase = createSupabaseBrowserClient()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [selected, setSelected] = useState<Challenge | null>(null)
  const [saving, setSaving] = useState(false)

  // form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('personal')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dailyCommitment, setDailyCommitment] = useState('')
  const [whyMatters, setWhyMatters] = useState('')
  const [description, setDescription] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('ninety_day_challenges')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setChallenges(data)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function createChallenge() {
    if (!title.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('ninety_day_challenges')
      .insert({
        title: title.trim(),
        category,
        start_date: startDate,
        daily_commitment: dailyCommitment.trim() || null,
        why_matters: whyMatters.trim() || null,
        description: description.trim() || null,
      })
      .select()
      .single()
    setSaving(false)
    if (data) {
      await load()
      setSelected(data)
      setView('detail')
      resetForm()
    }
  }

  function resetForm() {
    setTitle(''); setCategory('personal')
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setDailyCommitment(''); setWhyMatters(''); setDescription('')
  }

  function handleComplete(id: string) {
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, status: 'completed' as const } : c))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: 'completed' } : null)
  }

  const active    = challenges.filter(c => c.status === 'active')
  const completed = challenges.filter(c => c.status === 'completed')

  if (view === 'detail' && selected) {
    return (
      <ChallengeDetail
        challenge={selected}
        onBack={() => setView('list')}
        onComplete={handleComplete}
      />
    )
  }

  if (view === 'create') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">New 90-Day Challenge</h2>
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
            {saving ? 'Starting challenge…' : 'Start 90-Day Challenge'}
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
        Start a new 90-day challenge
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

      {/* Empty state */}
      {challenges.length === 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-10 text-center space-y-3">
          <div className="text-4xl">🔥</div>
          <p className="text-base font-semibold text-white">Transform your life in 90 days</p>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Pick one commitment, show up every day, and watch compound growth change everything.
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
