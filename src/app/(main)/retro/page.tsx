import { CalendarCheck } from 'lucide-react'
import dynamic from 'next/dynamic'
import { format, subMonths } from 'date-fns'

const MonthlyRetro = dynamic(() => import('@/components/retro/MonthlyRetro'), { ssr: false })

export default function RetroPage() {
  const prevMonth = format(subMonths(new Date(), 1), 'MMMM yyyy')
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30">
            <CalendarCheck className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Monthly Retrospective</h1>
            <p className="text-sm text-slate-500">{prevMonth} · AI deep-dive review</p>
          </div>
        </div>
        <MonthlyRetro />
      </div>
    </div>
  )
}
