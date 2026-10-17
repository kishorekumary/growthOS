import { todayStr, yesterdayStr } from '@/lib/habitStreak'
import { notifyPointsChanged } from '@/lib/pointsEvents'

export interface RewardMilestone {
  label:  string
  points: number
  // Non-milestone moments shown through the same popup queue.
  kind?:  'freeze' | 'chest'
}

export interface PerfectDay {
  date:   string  // YYYY-MM-DD the perfect day is for
  streak: number  // perfect-day streak including this day
  habits: number  // daily habits on that day
}

// Fired on window when a completion makes the day perfect — the layout's
// PerfectDayCelebration listens, so every place that checks off a habit
// gets the full-screen celebration without wiring it up itself.
export const PERFECT_DAY_EVENT = 'growthos:perfect-day'

export async function completeHabit(
  habitId: string,
  forDay: 'today' | 'yesterday' = 'today'
): Promise<{ streak_count: number; milestones: RewardMilestone[]; perfect_day?: PerfectDay | null }> {
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
  const result = await res.json()
  notifyPointsChanged()
  if (result.perfect_day) {
    window.dispatchEvent(new CustomEvent<PerfectDay>(PERFECT_DAY_EVENT, { detail: result.perfect_day }))
  }
  return result
}
