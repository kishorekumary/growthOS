import { Suspense } from 'react'
import { CalendarCheck2 } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import PlannerView from '@/components/planner/PlannerView'

export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader icon={CalendarCheck2} tone="emerald" title="Planner" subtitle="Today, this week, this month. Tap to check it off." />
      {/* useSearchParams in PlannerView needs a Suspense boundary. */}
      <Suspense>
        <PlannerView />
      </Suspense>
    </div>
  )
}
