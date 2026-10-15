'use client'

import dynamic from 'next/dynamic'
import { Target } from 'lucide-react'
import { SkeletonCards } from '@/components/ui/skeleton'

const GoalsList = dynamic(() => import('@/components/goals/GoalsList'), {
  loading: () => <SkeletonCards />,
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
          <p className="text-slate-400 text-sm mt-0.5">Define what success looks like — then make it happen.</p>
        </div>
      </div>

      <GoalsList />
    </div>
  )
}
