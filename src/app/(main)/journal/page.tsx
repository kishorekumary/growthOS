import { NotebookPen } from 'lucide-react'
import dynamic from 'next/dynamic'

const JournalApp = dynamic(() => import('@/components/journal/JournalApp'), { ssr: false })

export default function JournalPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30">
            <NotebookPen className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Voice Journal</h1>
            <p className="text-sm text-slate-500">Speak or write your daily reflections</p>
          </div>
        </div>
        <JournalApp />
      </div>
    </div>
  )
}
