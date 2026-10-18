'use client'

import { Dumbbell, Apple, ClipboardList, TrendingUp, Sparkles } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { SkeletonCards } from '@/components/ui/skeleton'
import GoalsWidget from '@/components/goals/GoalsWidget'

const WorkoutPlan     = dynamic(() => import('@/components/fitness/WorkoutPlan'),       { loading: () => <SectionSkeleton /> })
const WorkoutLogger   = dynamic(() => import('@/components/fitness/WorkoutLogger'),     { loading: () => <SectionSkeleton /> })
const FitnessProgress = dynamic(() => import('@/components/fitness/FitnessProgress'),   { loading: () => <SectionSkeleton /> })
const NutritionTracker = dynamic(() => import('@/components/fitness/NutritionTracker'), { loading: () => <SectionSkeleton /> })
const AIChat          = dynamic(() => import('@/components/shared/AIChat'),              { loading: () => <SectionSkeleton /> })

function SectionSkeleton() {
  return <SkeletonCards />
}

const TABS = ['Log Workout', 'Nutrition', 'Plan', 'Progress', 'Coach'] as const
type Tab = typeof TABS[number]
const TAB_ICONS = { 'Log Workout': Dumbbell, Nutrition: Apple, Plan: ClipboardList, Progress: TrendingUp, Coach: Sparkles }
const TAB_LABELS: Partial<Record<Tab, string>> = { 'Log Workout': 'Workout' }
const TAB_ITEMS = TABS.map(t => ({ value: t, label: TAB_LABELS[t] ?? t, icon: TAB_ICONS[t] }))

export default function FitnessPage() {
  const [tab, setTab] = useState<Tab>('Log Workout')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && (TABS as readonly string[]).includes(t)) setTab(t as Tab)
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <PageHeader icon={Dumbbell} tone="emerald" title="Fitness" subtitle="Train smart, recover well" />

      {/* Goals widget */}
      <GoalsWidget category="fitness" />

      <SegmentedTabs tabs={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === 'Plan'        && <WorkoutPlan />}
      {tab === 'Log Workout' && <WorkoutLogger />}
      {tab === 'Nutrition'   && <NutritionTracker />}
      {tab === 'Progress'    && <FitnessProgress />}
      {tab === 'Coach'       && <AIChat section="fitness" />}
    </div>
  )
}
