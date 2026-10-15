import dynamic from 'next/dynamic'
import { SkeletonCards } from '@/components/ui/skeleton'

const GoalsList = dynamic(() => import('@/components/goals/GoalsList'), {
  loading: () => <SkeletonCards />,
})

export default function PersonalityGoalsPage() {
  return <GoalsList />
}
