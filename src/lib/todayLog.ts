// Ordering and defaults for the Quick Log "Today" sheet.

export type TodayTile = 'sleep' | 'mood' | 'water' | 'plans' | 'meal' | 'workout' | 'spend'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink'

// What's most likely wanted at this hour comes first: sleep and mood in
// the morning, food at midday, spending and reflection in the evening.
export function tileOrder(hour: number): TodayTile[] {
  if (hour >= 4 && hour < 11)  return ['sleep', 'mood', 'plans', 'water', 'meal', 'workout', 'spend']
  if (hour >= 11 && hour < 17) return ['meal', 'water', 'plans', 'workout', 'spend', 'mood', 'sleep']
  if (hour >= 17 && hour < 21) return ['spend', 'mood', 'meal', 'workout', 'plans', 'water', 'sleep']
  return ['mood', 'spend', 'meal', 'plans', 'water', 'workout', 'sleep']
}

// Still-to-do tiles first, logged ones after; each group keeps tileOrder.
export function arrangeTiles(order: readonly TodayTile[], done: ReadonlySet<TodayTile>): TodayTile[] {
  return [...order.filter(t => !done.has(t)), ...order.filter(t => done.has(t))]
}

export function mealTypeFor(hour: number): MealType {
  return hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 20 ? 'dinner' : hour < 22 ? 'snack' : 'drink'
}

// Hours between two clock times, across midnight ("23:00" → "06:30" = 7.5).
export function hoursBetween(bed: string, wake: string): number {
  const [bh, bm] = bed.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  let mins = (wh * 60 + wm) - (bh * 60 + bm)
  if (mins < 0) mins += 1440
  return Math.round((mins / 60) * 10) / 10
}
