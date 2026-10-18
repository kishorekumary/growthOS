import { CalendarCheck } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'
import { format, subMonths } from 'date-fns'

const MonthlyRetro = dynamic(() => import('@/components/retro/MonthlyRetro'), { ssr: false })

export default function RetroPage() {
  const prevMonth = format(subMonths(new Date(), 1), 'MMMM yyyy')
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="space-y-6">
        <PageHeader icon={CalendarCheck} tone="rose" title="Monthly Retrospective" subtitle={<>{prevMonth} · AI deep-dive review</>} />
        <MonthlyRetro />
      </div>
    </div>
  )
}
