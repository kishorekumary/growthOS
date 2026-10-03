'use client'

import { useState } from 'react'
import { Loader2, Check, X as XIcon, Zap } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useDecisions } from '@/hooks/useDecisions'
import { todayStr } from '@/lib/habitStreak'
import { daysSince, dueCheckIn, isKept, type Decision } from '@/lib/decisionLog'
import CheckInPrompt from './CheckInPrompt'
import { cn } from '@/lib/utils'

export default function DecisionLog() {
  const today = todayStr()
  const { decisions, loading, available, setDecisions, answer } = useDecisions()
  const [statement, setStatement] = useState('')
  const [action, setAction]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function save() {
    if (!statement.trim() || !action.trim() || saving) return
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    const { data, error } = await supabase.from('decisions')
      .insert({ user_id: session.user.id, statement: statement.trim(), first_action: action.trim(), decided_on: today })
      .select('id, statement, first_action, decided_on, action_taken, review_7, review_30, created_at')
      .single()
    if (error || !data) setError('Could not save your decision')
    else {
      setDecisions(prev => [data as Decision, ...prev])
      setStatement(''); setAction('')
    }
    setSaving(false)
  }

  if (loading && decisions.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  }
  if (!available) {
    return <p className="text-sm text-slate-500">The decision log needs database migration 050 to be applied.</p>
  }

  const reviewed = decisions.filter(d => isKept(d) !== null)
  const kept     = reviewed.filter(d => isKept(d)).length

  return (
    <div className="space-y-6">
      {/* New decision */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5 space-y-3">
        <p className="text-sm text-slate-300 leading-relaxed">
          A real decision cuts off every other option. Write it as who you are now, then take one action
          in the next 24 hours, while the decision is fresh.
        </p>
        <textarea
          value={statement}
          onChange={e => setStatement(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="I've decided… (e.g. From now on, I never skip a workout two days in a row)"
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
        />
        <input
          value={action}
          onChange={e => setAction(e.target.value)}
          maxLength={200}
          placeholder="First action in the next 24 hours (e.g. Book a trainer for Monday)"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={!statement.trim() || !action.trim() || saving}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 px-4 py-2 text-sm font-semibold text-white"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Commit to this decision
        </button>
      </div>

      {reviewed.length > 0 && (
        <p className="text-xs text-slate-500">
          {decisions.length} decision{decisions.length === 1 ? '' : 's'} · <span className="text-emerald-400">{kept} kept</span> of {reviewed.length} checked in
        </p>
      )}

      <ul className="space-y-3">
        {decisions.map(d => {
          const due  = dueCheckIn(d, today)
          const kept = isKept(d)
          const age  = daysSince(d.decided_on, today)
          return (
            <li key={d.id} className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-white">{d.statement}</p>
                {kept !== null && (
                  <span className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    kept ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300',
                  )}>
                    {kept ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
                    {kept ? 'Kept' : 'Slipped'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                First action: {d.first_action}
                <span className="text-slate-600"> · {age === 0 ? 'today' : `${age}d ago`}</span>
              </p>
              {due && <CheckInPrompt decision={d} checkIn={due} onAnswer={answer} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
