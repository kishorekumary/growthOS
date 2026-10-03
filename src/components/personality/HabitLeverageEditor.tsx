'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useHabitLeverage } from '@/hooks/useHabitLeverage'

// "Shoulds into musts": the user's own reasons, in their words — what
// skipping this habit costs them, and what doing it gives them. Shown back
// on the Today card and in the streak-at-risk notification.
export default function HabitLeverageEditor({ habitId }: { habitId: string }) {
  const { byHabit, available, loading, setData } = useHabitLeverage()
  const current = byHabit.get(habitId)
  const [pain, setPain]         = useState('')
  const [pleasure, setPleasure] = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    setPain(current?.pain ?? '')
    setPleasure(current?.pleasure ?? '')
  }, [current?.pain, current?.pleasure])

  if (!available || loading) return null

  const dirty = pain !== (current?.pain ?? '') || pleasure !== (current?.pleasure ?? '')

  async function save() {
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const row = { habit_id: habitId, pain: pain.trim() || null, pleasure: pleasure.trim() || null }
      const { error } = await supabase.from('habit_leverage').upsert(
        { ...row, user_id: session.user.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,habit_id' },
      )
      if (!error) {
        setData(prev => [...prev.filter(l => l.habit_id !== habitId), row])
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    }
    setSaving(false)
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/8 bg-white/3 p-3">
      <div>
        <p className="text-xs font-semibold text-slate-300">Your leverage</p>
        <p className="text-[11px] text-slate-500">Turn this from a &ldquo;should&rdquo; into a &ldquo;must&rdquo;. Be specific and honest.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] text-red-300/80">If I keep skipping this, it will cost me…</span>
        <textarea
          value={pain}
          onChange={e => setPain(e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="e.g. my energy, my health at 50, my kids seeing me give up"
          className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500/50"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] text-emerald-300/80">Doing it gives me…</span>
        <textarea
          value={pleasure}
          onChange={e => setPleasure(e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="e.g. a clear head, pride, proof I keep promises to myself"
          className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="flex items-center gap-1.5 rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-white"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : null}
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  )
}
