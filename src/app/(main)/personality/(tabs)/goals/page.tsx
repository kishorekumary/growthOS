import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const GoalsList = dynamic(() => import('@/components/goals/GoalsList'), {
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  ),
})

export default function PersonalityGoalsPage() {
  return <GoalsList />
}
