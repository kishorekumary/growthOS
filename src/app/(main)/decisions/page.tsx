'use client'

import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'
import { Zap } from 'lucide-react'
import { SkeletonCards } from '@/components/ui/skeleton'

const DecisionLog = dynamic(() => import('@/components/decisions/DecisionLog'), {
  loading: () => <SkeletonCards />,
})

export default function DecisionsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <PageHeader icon={Zap} tone="amber" title="Decisions" subtitle="It&apos;s in your moments of decision that your destiny is shaped." />

      <DecisionLog />
    </div>
  )
}
