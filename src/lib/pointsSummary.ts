import { startOfDay, startOfWeek, subDays } from 'date-fns'

// Reading the points ledger (reward_points_log) for the Rewards page.
// Earning rows are everything except spending: redemptions ("Redeemed: …")
// and shop purchases ("Bought: …"). Planner un-checks are negative earning
// rows, so they correctly take back what the check-off gave.

export interface PointsLogRow { delta: number; reason: string; created_at: string }

export const SPEND_PREFIXES = ['Redeemed:', 'Bought:'] as const

export function isSpend(row: Pick<PointsLogRow, 'delta' | 'reason'>): boolean {
  return row.delta < 0 && SPEND_PREFIXES.some(p => row.reason.startsWith(p))
}

export interface PointsSummary {
  earnedAllTime: number  // balance + everything ever spent
  today:         number  // net earned since local midnight
  week:          number  // net earned since Monday (local)
  dailyPace:     number  // average net earned per day over the last 7 days
}

// `recent` must cover at least the last 7 days; `totalSpent` is the
// positive sum of all spending ever.
export function summarizePoints(
  recent: readonly PointsLogRow[], balance: number, totalSpent: number, now = new Date(),
): PointsSummary {
  const dayStart  = startOfDay(now).getTime()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).getTime()
  const paceStart = startOfDay(subDays(now, 6)).getTime()

  let today = 0, week = 0, last7 = 0
  for (const row of recent) {
    if (isSpend(row)) continue
    const t = new Date(row.created_at).getTime()
    if (t >= dayStart)  today += row.delta
    if (t >= weekStart) week  += row.delta
    if (t >= paceStart) last7 += row.delta
  }
  return {
    earnedAllTime: balance + totalSpent,
    today, week,
    dailyPace: Math.max(0, last7 / 7),
  }
}

// Whole days until `cost` is affordable at `pace` points/day; 0 when it
// already is, null when there's no recent earning to estimate from.
export function daysToAfford(cost: number, balance: number, pace: number): number | null {
  if (balance >= cost) return 0
  if (pace <= 0) return null
  return Math.ceil((cost - balance) / pace)
}
