import { todayStr, yesterdayStr } from '@/lib/habitStreak'

export interface RewardMilestone { label: string; points: number }

export async function completeHabit(
  habitId: string,
  forDay: 'today' | 'yesterday' = 'today'
): Promise<{ streak_count: number; milestones: RewardMilestone[] }> {
  // Compute the target date here, client-side, using the browser's local
  // timezone (todayStr/yesterdayStr resolve via plain JS Date methods,
  // which are correct here since this code runs in the user's browser).
  // The server can't reliably derive "today" itself — Vercel's runtime
  // resolves plain Date methods to UTC, not the user's timezone — so the
  // client sends its own local date and the server treats it as the
  // source of truth (within a loose sanity bound).
  const date = forDay === 'yesterday' ? yesterdayStr() : todayStr()
  const res = await fetch('/api/habits/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habit_id: habitId, for: forDay, date }),
  })
  if (!res.ok) throw new Error('Failed to complete habit')
  return res.json()
}
