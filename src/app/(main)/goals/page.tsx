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
        <div className="relative">
          <div aria-hidden className="absolute inset-0 rounded-2xl bg-violet-500/40 blur-xl" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
            <Target className="h-6 w-6 text-snow" />
          </div>
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
