import { NotebookPen } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'

const JournalApp = dynamic(() => import('@/components/journal/JournalApp'), { ssr: false })

export default function JournalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="space-y-6">
        <PageHeader icon={NotebookPen} tone="indigo" title="Voice Journal" subtitle="Speak or write your daily reflections" />
        <JournalApp />
      </div>
    </div>
  )
}
