'use client'

import { CHECK_IN_PROMPT, type CheckIn, type Decision } from '@/lib/decisionLog'

// Yes/no check-in for one decision — shared by the log and the dashboard card.
export default function CheckInPrompt({ decision, checkIn, onAnswer }: {
  decision: Decision
  checkIn:  CheckIn
  onAnswer: (d: Decision, c: CheckIn, yes: boolean) => void
}) {
  const [yes, no] = checkIn === 'action' ? ['Yes, done', 'Not yet'] : ['Kept it', 'Slipped']
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
      <p className="text-xs text-amber-200">{CHECK_IN_PROMPT[checkIn]}</p>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onAnswer(decision, checkIn, true)}
          className="rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white">
          {yes}
        </button>
        <button type="button" onClick={() => onAnswer(decision, checkIn, false)}
          className="rounded-md bg-white/10 hover:bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
          {no}
        </button>
      </div>
    </div>
  )
}
