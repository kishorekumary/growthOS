import { Newspaper } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'

const WeeklyDigest = dynamic(() => import('@/components/digest/WeeklyDigest'), { ssr: false })

export default function DigestPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="space-y-6">
        <PageHeader icon={Newspaper} tone="fuchsia" title="Weekly Digest" subtitle="AI-powered review of your week" />
        <WeeklyDigest />
      </div>
    </div>
  )
}
