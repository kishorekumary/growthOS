import { Flame } from 'lucide-react'
import dynamic from 'next/dynamic'

const ChallengeApp = dynamic(() => import('@/components/challenges/ChallengeApp'), { ssr: false })

export default function ChallengesPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 border border-orange-500/30">
            <Flame className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">90-Day Challenge</h1>
            <p className="text-sm text-slate-500">One commitment. 90 days. Transformation.</p>
          </div>
        </div>
        <ChallengeApp />
      </div>
    </div>
  )
}
