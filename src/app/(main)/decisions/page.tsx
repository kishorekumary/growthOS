'use client'

import dynamic from 'next/dynamic'
import { Zap } from 'lucide-react'
import { SkeletonCards } from '@/components/ui/skeleton'

const DecisionLog = dynamic(() => import('@/components/decisions/DecisionLog'), {
  loading: () => <SkeletonCards />,
})

export default function DecisionsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/20 border border-amber-500/30">
          <Zap className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Decisions</h1>
          <p className="text-slate-400 text-sm mt-0.5">It&apos;s in your moments of decision that your destiny is shaped.</p>
        </div>
      </div>

      <DecisionLog />
    </div>
  )
}
