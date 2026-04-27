'use client'

import dynamic from 'next/dynamic'
import { Target, Loader2 } from 'lucide-react'

const GoalsList = dynamic(() => import('@/components/goals/GoalsList'), {
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  ),
})

export default function GoalsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/30">
          <Target className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">My Goals</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track what matters across every area of your life</p>
        </div>
      </div>

      <GoalsList />
    </div>
  )
}
