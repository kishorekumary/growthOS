'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ArrowRight } from 'lucide-react'
import { useWorkbook } from '@/hooks/useWorkbook'
import { PROGRAM, type Exercise } from '@/lib/workbook'
import ExerciseRunner from '@/components/workbook/ExerciseRunner'

// Today's workbook exercise(s) on the dashboard; renders nothing when none are due.
export default function WorkbookDue() {
  const { loading, sessions, status, today, markDone } = useWorkbook()
  const [active, setActive] = useState<Exercise | null>(null)
  if (loading && sessions.length === 0) return null
  if (!status.due.length && !active) return null

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">{active ? active.title : 'Workbook'}</span>
        </div>
        <Link href="/workbook" className="flex items-center gap-1 text-xs text-slate-500 hover:text-white">
          All exercises <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {active ? (
        <ExerciseRunner
          exercise={active}
          date={today}
          onClose={() => setActive(null)}
          onSaved={() => { markDone(active.slug); setActive(null) }}
        />
      ) : (
        <div className="space-y-2">
          {status.due.map(e => (
            <button
              key={e.slug}
              type="button"
              onClick={() => setActive(e)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-left transition-colors hover:bg-white/6"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">{e.title}</span>
                <span className="block text-[11px] text-slate-500">
                  {e.cadence === 'once'
                    ? `Day ${status.programDone + 1} of ${PROGRAM.length} · ${e.questions.length} questions`
                    : `${e.cadence === 'weekly' ? 'Weekly' : 'Monthly'} review · ${e.questions.length} questions`}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-violet-300">Start</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
