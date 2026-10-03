// Streak freezes: one covers one whole missed day (every daily habit streak
// plus the perfect-day streak). See supabase/migrations/049.
export const FREEZE_MAX  = 3     // most a user can hold at once
export const FREEZE_COST = 150   // points, in the Rewards store

// Every Nth consecutive day the chest is opened guarantees a freeze.
export const CHEST_FREEZE_EVERY = 7
// Points paid instead of a freeze when the user already holds FREEZE_MAX.
export const FREEZE_CAP_FALLBACK_POINTS = 40

export interface ChestRoll {
  points: number
  freeze: boolean
  label:  string
}

function between(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1))
}

// Variable reward for the day's chest. `chestStreak` counts consecutive days
// opened, including today. Kept pure (rand injected) so odds are testable;
// the server applies the freeze cap afterwards via resolveFreezeCap.
export function rollChest(chestStreak: number, rand: () => number = Math.random): ChestRoll {
  if (chestStreak > 0 && chestStreak % CHEST_FREEZE_EVERY === 0) {
    return { points: 25, freeze: true, label: `Day ${chestStreak} bonus: streak freeze + 25 points` }
  }
  const r = rand()
  if (r < 0.05) return { points: 100, freeze: false, label: 'Jackpot! 100 points' }
  if (r < 0.15) return { points: 0,   freeze: true,  label: 'Streak freeze' }
  if (r < 0.40) {
    const p = between(rand, 30, 50)
    return { points: p, freeze: false, label: `${p} points` }
  }
  const p = between(rand, 10, 25)
  return { points: p, freeze: false, label: `${p} points` }
}

// A freeze the user can't hold (already at FREEZE_MAX) becomes points.
export function resolveFreezeCap(roll: ChestRoll, freezeGranted: boolean): ChestRoll {
  if (!roll.freeze || freezeGranted) return roll
  const points = roll.points + FREEZE_CAP_FALLBACK_POINTS
  return { points, freeze: false, label: `${points} points (freeze slots full)` }
}

// Pure calendar arithmetic on YYYY-MM-DD — no timezone involved.
export function prevDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
