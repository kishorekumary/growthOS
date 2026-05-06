'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, Smile, Zap, RefreshCw } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Checkin {
  id: string
  checked_at: string
  mood: number
  energy: number
  word: string | null
  note: string | null
}

const MOOD_LABELS  = ['Terrible', 'Bad', 'Okay', 'Good', 'Amazing']
const ENERGY_LABELS = ['Exhausted', 'Low', 'Moderate', 'High', 'Peak']
const MOOD_COLORS  = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4']
const QUICK_WORDS  = ['Focused', 'Anxious', 'Motivated', 'Tired', 'Happy', 'Stressed', 'Calm', 'Excited', 'Grateful', 'Overwhelmed']

function ScalePicker({
  label, icon: Icon, value, onChange, labels, colors,
}: {
  label: string
  icon: React.ElementType
  value: number
  onChange: (v: number) => void
  labels: string[]
  colors: string[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-300">{label}</span>
        {value > 0 && (
          <span className="ml-auto text-xs font-medium" style={{ color: colors[value - 1] }}>
            {labels[value - 1]}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 h-10 rounded-lg border text-sm font-bold transition-all',
              value === n
                ? 'border-transparent text-white shadow-lg scale-105'
                : 'border-white/10 bg-white/5 text-slate-500 hover:border-white/20 hover:text-white'
            )}
            style={value === n ? { background: colors[n - 1] + '33', borderColor: colors[n - 1] + '88', color: colors[n - 1] } : {}}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MoodCheckin() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [existing, setExisting]   = useState<Checkin | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [editing, setEditing]     = useState(false)

  const [mood,   setMood]   = useState(0)
  const [energy, setEnergy] = useState(0)
  const [word,   setWord]   = useState('')
  const [note,   setNote]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { data } = await supabase
      .from('mood_checkins')
      .select('*')
      .eq('checked_at', today)
      .maybeSingle()
    if (data) {
      setExisting(data as Checkin)
      setMood(data.mood); setEnergy(data.energy)
      setWord(data.word ?? ''); setNote(data.note ?? '')
    }
    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!mood || !energy) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await supabase.from('mood_checkins').upsert({
      user_id: user.id,
      checked_at: today,
      mood, energy,
      word: word.trim() || null,
      note: note.trim() || null,
    }, { onConflict: 'user_id,checked_at' })

    setSaving(false)
    setSaved(true)
    setEditing(false)
    load()
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  if (existing && !editing) return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-semibold text-white">Today's Check-in Done</p>
        </div>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors">
          <RefreshCw className="h-3 w-3" /> Edit
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Mood</p>
          <p className="text-2xl font-bold" style={{ color: MOOD_COLORS[existing.mood - 1] }}>{existing.mood}/5</p>
          <p className="text-xs mt-1" style={{ color: MOOD_COLORS[existing.mood - 1] }}>{MOOD_LABELS[existing.mood - 1]}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Energy</p>
          <p className="text-2xl font-bold" style={{ color: MOOD_COLORS[existing.energy - 1] }}>{existing.energy}/5</p>
          <p className="text-xs mt-1" style={{ color: MOOD_COLORS[existing.energy - 1] }}>{ENERGY_LABELS[existing.energy - 1]}</p>
        </div>
      </div>
      {existing.word && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Feeling:</span>
          <span className="rounded-full bg-violet-500/20 px-3 py-0.5 text-xs font-medium text-violet-300">{existing.word}</span>
        </div>
      )}
      {existing.note && <p className="text-xs text-slate-400 italic">"{existing.note}"</p>}
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
          <Smile className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Daily Check-in</p>
          <p className="text-xs text-slate-500">How are you feeling today?</p>
        </div>
      </div>

      <ScalePicker label="Mood"   icon={Smile} value={mood}   onChange={setMood}   labels={MOOD_LABELS}   colors={MOOD_COLORS} />
      <ScalePicker label="Energy" icon={Zap}   value={energy} onChange={setEnergy} labels={ENERGY_LABELS} colors={MOOD_COLORS} />

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400">One word (optional)</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_WORDS.map(w => (
            <button key={w} type="button" onClick={() => setWord(word === w ? '' : w)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium border transition-all',
                word === w
                  ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
              )}
            >{w}</button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-400">Note (optional)</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What's on your mind today?"
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
        />
      </div>

      <button
        onClick={submit}
        disabled={!mood || !energy || saving}
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 py-2.5 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : null}
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Submit Check-in'}
      </button>
    </div>
  )
}
