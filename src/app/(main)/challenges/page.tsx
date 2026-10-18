import { Flame } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'

const ChallengeApp = dynamic(() => import('@/components/challenges/ChallengeApp'), { ssr: false })

export default function ChallengesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="space-y-6">
        <PageHeader icon={Flame} tone="amber" title="90-Day Challenge" subtitle="One commitment. 90 days. Transformation." />
        <ChallengeApp />
      </div>
    </div>
  )
}
