export interface RewardMilestone { label: string; points: number }

export async function completeHabit(
  habitId: string,
  forDay: 'today' | 'yesterday' = 'today'
): Promise<{ streak_count: number; milestones: RewardMilestone[] }> {
  const res = await fetch('/api/habits/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habit_id: habitId, for: forDay }),
  })
  if (!res.ok) throw new Error('Failed to complete habit')
  return res.json()
}
