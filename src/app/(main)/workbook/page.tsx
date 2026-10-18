'use client'

import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'
import { ClipboardList } from 'lucide-react'
import { SkeletonCards } from '@/components/ui/skeleton'

const WorkbookApp = dynamic(() => import('@/components/workbook/WorkbookApp'), {
  loading: () => <SkeletonCards />,
})

export default function WorkbookPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <PageHeader icon={ClipboardList} tone="violet" title="Workbook" subtitle="Change happens on paper first. One exercise a day." />

      <WorkbookApp />
    </div>
  )
}
