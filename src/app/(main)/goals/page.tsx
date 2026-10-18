'use client'

import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'
import { Target } from 'lucide-react'
import { SkeletonCards } from '@/components/ui/skeleton'

const GoalsList = dynamic(() => import('@/components/goals/GoalsList'), {
  loading: () => <SkeletonCards />,
})

export default function GoalsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <PageHeader icon={Target} tone="fuchsia" title="My Goals" subtitle="Define what success looks like — then make it happen." />

      <GoalsList />
    </div>
  )
}
