'use client'

import { Sparkles, X } from 'lucide-react'
import { useReward } from '@/contexts/RewardContext'

export default function RewardMilestoneModal() {
  const { queue, dismissCurrent } = useReward()
  const current = queue[0]
  if (!current) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-center space-y-4 shadow-2xl">
        <button onClick={dismissCurrent} className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 border-2 border-amber-500/40 mx-auto">
          <Sparkles className="h-8 w-8 text-amber-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">🎉 {current.label}</p>
          <p className="text-amber-400 font-semibold mt-1">+{current.points} points</p>
        </div>
        <button
          onClick={dismissCurrent}
          className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-3 text-sm font-semibold text-white transition-all"
        >
          Nice!
        </button>
      </div>
    </div>
  )
}
