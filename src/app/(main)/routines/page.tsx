import { ListChecks } from 'lucide-react'
import dynamic from 'next/dynamic'

const RoutineBuilder = dynamic(() => import('@/components/routines/RoutineBuilder'), { ssr: false })

export default function RoutinesPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30">
            <ListChecks className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Routines</h1>
            <p className="text-sm text-slate-500">Build and execute your daily rituals</p>
          </div>
        </div>
        <RoutineBuilder />
      </div>
    </div>
  )
}
