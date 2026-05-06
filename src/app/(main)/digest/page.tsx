import { Newspaper } from 'lucide-react'
import dynamic from 'next/dynamic'

const WeeklyDigest = dynamic(() => import('@/components/digest/WeeklyDigest'), { ssr: false })

export default function DigestPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30">
            <Newspaper className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Weekly Digest</h1>
            <p className="text-sm text-slate-500">AI-powered review of your week</p>
          </div>
        </div>
        <WeeklyDigest />
      </div>
    </div>
  )
}
