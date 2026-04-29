'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import GoalsWidget from '@/components/goals/GoalsWidget'

const WorkoutPlan     = dynamic(() => import('@/components/fitness/WorkoutPlan'),       { loading: () => <Spinner /> })
const WorkoutLogger   = dynamic(() => import('@/components/fitness/WorkoutLogger'),     { loading: () => <Spinner /> })
const FitnessProgress = dynamic(() => import('@/components/fitness/FitnessProgress'),   { loading: () => <Spinner /> })
const NutritionTracker = dynamic(() => import('@/components/fitness/NutritionTracker'), { loading: () => <Spinner /> })
const AIChat          = dynamic(() => import('@/components/shared/AIChat'),              { loading: () => <Spinner /> })

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )
}

const TABS = ['Plan', 'Log Workout', 'Nutrition', 'Progress', 'Coach'] as const
type Tab = typeof TABS[number]

export default function FitnessPage() {
  const [tab, setTab] = useState<Tab>('Plan')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Fitness</h1>
        <p className="text-slate-400 text-sm mt-1">Train smart, recover well</p>
      </div>

      {/* Goals widget */}
      <GoalsWidget category="fitness" />

      {/* Tab bar — scrollable for smaller screens */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 mb-6 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-shrink-0 rounded-lg px-3 py-2 text-center text-sm font-medium transition-all whitespace-nowrap',
              tab === t
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Plan'        && <WorkoutPlan />}
      {tab === 'Log Workout' && <WorkoutLogger />}
      {tab === 'Nutrition'   && <NutritionTracker />}
      {tab === 'Progress'    && <FitnessProgress />}
      {tab === 'Coach'       && <AIChat section="fitness" />}
    </div>
  )
}
