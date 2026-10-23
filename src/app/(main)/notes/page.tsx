import { StickyNote } from 'lucide-react'
import { Suspense } from 'react'
import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'

const NotesApp = dynamic(() => import('@/components/notes/NotesApp'), { ssr: false })

export default function NotesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="space-y-6">
        <PageHeader icon={StickyNote} tone="amber" title="Notes" subtitle="Lists, ideas and things to remember" />
        <Suspense>
          <NotesApp />
        </Suspense>
      </div>
    </div>
  )
}
