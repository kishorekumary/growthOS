import { ListChecks } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'

const RoutineBuilder = dynamic(() => import('@/components/routines/RoutineBuilder'), { ssr: false })

export default function RoutinesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="space-y-6">
        <PageHeader icon={ListChecks} tone="amber" title="Routines" subtitle="Build and execute your daily rituals" />
        <RoutineBuilder />
      </div>
    </div>
  )
}
