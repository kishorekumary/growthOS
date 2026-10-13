import { Suspense } from 'react'
import PlannerView from '@/components/planner/PlannerView'

export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Planner</h1>
        <p className="mt-1 text-sm text-slate-400">Today, this week, this month. Tap to check it off.</p>
      </div>
      {/* useSearchParams in PlannerView needs a Suspense boundary. */}
      <Suspense>
        <PlannerView />
      </Suspense>
    </div>
  )
}
