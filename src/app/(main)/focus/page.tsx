'use client'

import dynamic from 'next/dynamic'
import { Timer, Loader2 } from 'lucide-react'

const FocusTimer = dynamic(() => import('@/components/focus/FocusTimer'), {
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  ),
})

export default function FocusPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/30">
          <Timer className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Focus</h1>
          <p className="text-slate-400 text-sm mt-0.5">Build sequences of timed intervals with alerts</p>
        </div>
      </div>

      <FocusTimer />
    </div>
  )
}
