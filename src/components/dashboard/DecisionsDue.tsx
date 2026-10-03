'use client'

import Link from 'next/link'
import { Zap, ArrowRight } from 'lucide-react'
import { useDecisions } from '@/hooks/useDecisions'
import { todayStr } from '@/lib/habitStreak'
import { dueCheckIn } from '@/lib/decisionLog'
import CheckInPrompt from '@/components/decisions/CheckInPrompt'

// Surfaces decision check-ins on the dashboard only when one is due.
export default function DecisionsDue() {
  const today = todayStr()
  const { decisions, available, answer } = useDecisions()
  if (!available) return null
  const due = decisions
    .map(d => ({ d, checkIn: dueCheckIn(d, today) }))
    .filter((x): x is { d: typeof x.d; checkIn: NonNullable<typeof x.checkIn> } => x.checkIn !== null)
  if (due.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Decision check-in</span>
        </div>
        <Link href="/decisions" className="flex items-center gap-1 text-xs text-slate-500 hover:text-white">
          All decisions <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {due.slice(0, 2).map(({ d, checkIn }) => (
        <div key={d.id} className="space-y-1.5">
          <p className="text-sm text-slate-200">{d.statement}</p>
          <CheckInPrompt decision={d} checkIn={checkIn} onAnswer={answer} />
        </div>
      ))}
    </div>
  )
}
