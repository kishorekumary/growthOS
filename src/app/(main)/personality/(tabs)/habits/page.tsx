import dynamic from 'next/dynamic'

const HabitTracker = dynamic(() => import('@/components/personality/HabitTracker'), { ssr: false })
const SleepTracker = dynamic(() => import('@/components/checkin/SleepTracker'),     { ssr: false })

export default function HabitsPage() {
  return (
    <div className="space-y-6">
      <HabitTracker />
      <SleepTracker />
    </div>
  )
}
