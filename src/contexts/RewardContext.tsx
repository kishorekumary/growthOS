'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type { RewardMilestone } from '@/lib/completeHabit'

interface RewardCtx {
  queue: RewardMilestone[]
  celebrateMilestones: (milestones: RewardMilestone[]) => void
  dismissCurrent: () => void
}

const RewardContext = createContext<RewardCtx | null>(null)

export function useReward() {
  const ctx = useContext(RewardContext)
  if (!ctx) throw new Error('useReward must be used within RewardProvider')
  return ctx
}

export function RewardProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<RewardMilestone[]>([])

  function celebrateMilestones(milestones: RewardMilestone[]) {
    if (milestones.length === 0) return
    setQueue(prev => [...prev, ...milestones])
  }

  function dismissCurrent() {
    setQueue(prev => prev.slice(1))
  }

  return (
    <RewardContext.Provider value={{ queue, celebrateMilestones, dismissCurrent }}>
      {children}
    </RewardContext.Provider>
  )
}
