export const MILESTONE_THRESHOLDS = [7, 14, 30, 60, 90, 180, 365] as const

export const PER_HABIT_MILESTONE_POINTS: Record<number, number> = {
  7: 50, 14: 100, 30: 250, 60: 500, 90: 1000, 180: 2000, 365: 5000,
}

export const OVERALL_MILESTONE_POINTS: Record<number, number> = {
  7: 150, 14: 300, 30: 750, 60: 1500, 90: 3000, 180: 6000, 365: 15000,
}

export const DAILY_POINTS          = 5
export const DAILY_POINTS_KEYSTONE = 10

// Returns the highest milestone threshold <= streakCount, or 0 if none reached.
export function highestMilestoneCrossed(streakCount: number): number {
  let highest = 0
  for (const t of MILESTONE_THRESHOLDS) {
    if (streakCount >= t) highest = t
  }
  return highest
}
