// "What you usually do" — pre-fills and one-tap chips for Quick Log, so
// most entries are a tap instead of typing.

// Average of clock times ("23:10", "00:20", …), treating the clock as a
// circle so bedtimes either side of midnight average sensibly. Rounded to
// 5 minutes; null when there's nothing to average.
export function averageClock(times: readonly (string | null | undefined)[]): string | null {
  const mins = times
    .filter((t): t is string => !!t && /^\d{1,2}:\d{2}/.test(t))
    .map(t => { const [h, m] = t.split(':').map(Number); return h * 60 + m })
  if (!mins.length) return null
  const toRad = (m: number) => (m / 1440) * 2 * Math.PI
  const x = mins.reduce((s, m) => s + Math.cos(toRad(m)), 0)
  const y = mins.reduce((s, m) => s + Math.sin(toRad(m)), 0)
  let avg = Math.round(((Math.atan2(y, x) / (2 * Math.PI)) * 1440 + 1440) % 1440)
  avg = (Math.round(avg / 5) * 5) % 1440
  return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`
}

// Distinct items ranked by how often they occur; ties go to the most
// recent. `rows` must be newest first.
export function topRepeats<T>(rows: readonly T[], key: (r: T) => string, n: number): T[] {
  const seen = new Map<string, { row: T; count: number; firstIdx: number }>()
  rows.forEach((row, i) => {
    const k = key(row)
    const hit = seen.get(k)
    if (hit) hit.count++
    else seen.set(k, { row, count: 1, firstIdx: i })
  })
  return Array.from(seen.values())
    .sort((a, b) => b.count - a.count || a.firstIdx - b.firstIdx)
    .slice(0, n)
    .map(x => x.row)
}

// Most frequent recent workout type and its typical (median) length,
// rounded to 5 minutes. `rows` newest first.
export function usualWorkout<T extends { workout_type: string; duration_mins: number | null }>(
  rows: readonly T[],
): { workout_type: string; duration_mins: number } | null {
  const recent = rows.filter(r => r.workout_type !== 'rest').slice(0, 20)
  if (!recent.length) return null
  const type = topRepeats(recent, r => r.workout_type, 1)[0].workout_type
  const lengths = recent.filter(r => r.workout_type === type && r.duration_mins).map(r => r.duration_mins!).sort((a, b) => a - b)
  const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 30
  return { workout_type: type, duration_mins: Math.max(5, Math.round(median / 5) * 5) }
}
