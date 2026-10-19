// Turning Health Connect records (as returned by @capgo/capacitor-health)
// into GrowthOS rows. Pure, so it's tested without a phone.

export type AppWorkoutType = 'cardio' | 'strength' | 'yoga' | 'sports' | 'rest'

const STRENGTH = /strength|weight|calisthenic|crossTraining|core|bench|deadlift|curl|press|raise|extension|latPull|lunge|plank|crunch|sitUp|burpee|jumpingJack|backExtension|bootCamp|exerciseClass/i
const YOGA = /yoga|pilates|flexibility|stretch|mindAndBody|taiChi|barre|meditation|breathing|cooldown/i
const SPORTS = /ball|badminton|cricket|soccer|tennis|squash|golf|hockey|rugby|lacrosse|curling|fencing|boxing|martial|wrestling|archery|racquet|pickleball|frisbee|disc|play|skating|ski|snow|surf|sail|paddl|rowing$|climb|equestrian|fishing|hunting|diving|sports/i

export function mapWorkoutType(t: string): AppWorkoutType {
  if (STRENGTH.test(t)) return 'strength'
  if (YOGA.test(t)) return 'yoga'
  if (SPORTS.test(t)) return 'sports'
  return 'cardio'
}

// "highIntensityIntervalTraining" → "High intensity interval training"
export function workoutLabel(t: string): string {
  const words = t.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const pad = (n: number) => String(n).padStart(2, '0')
export const localDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const localClock = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

export function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

export interface HcWorkout {
  workoutType: string; duration: number; totalEnergyBurned?: number; totalDistance?: number
  startDate: string; endDate: string; platformId?: string; sourceName?: string
}

export function workoutRow(w: HcWorkout) {
  const extras = [
    workoutLabel(w.workoutType),
    w.totalDistance ? `${(w.totalDistance / 1000).toFixed(w.totalDistance >= 10_000 ? 0 : 1)} km` : null,
    w.totalEnergyBurned ? `${Math.round(w.totalEnergyBurned)} kcal` : null,
  ].filter(Boolean)
  return {
    log_date:      localDate(w.startDate),
    workout_type:  mapWorkoutType(w.workoutType),
    duration_mins: Math.max(1, Math.round(w.duration / 60)),
    exercises:     [],
    notes:         `${extras.join(' · ')} · from Samsung Health`,
    source:        'health_connect',
    external_id:   w.platformId ?? `${w.workoutType}:${w.startDate}`,
  }
}

export interface HcStage { stage: string; durationMinutes: number }
export interface HcSleep { value: number; startDate: string; endDate: string; platformId?: string; stages?: HcStage[] }

// 1–5 from how much of the night was actually asleep and how much of it
// was deep or REM. Without stage data, from length alone.
export function sleepQuality(s: HcSleep): number {
  const total = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60_000
  const stages = s.stages ?? []
  const sum = (names: string[]) => stages.filter(x => names.includes(x.stage)).reduce((a, x) => a + x.durationMinutes, 0)
  if (!stages.length || total <= 0) {
    const h = total / 60
    return h >= 8 ? 4 : h >= 7 ? 4 : h >= 6 ? 3 : h >= 5 ? 2 : 1
  }
  const asleep = sum(['asleep', 'light', 'deep', 'rem'])
  const efficiency = asleep / total
  const restorative = asleep ? sum(['deep', 'rem']) / asleep : 0
  const score = efficiency * 60 + restorative * 100   // ~ 0.9×60 + 0.4×100 ≈ 94 for a great night
  return score >= 85 ? 5 : score >= 72 ? 4 : score >= 60 ? 3 : score >= 45 ? 2 : 1
}

export const MIN_SLEEP_MINUTES = 180   // shorter sessions are naps; not a night's sleep

// One night per wake-up day: the longest session that ends on that day.
export function nightlySleep(samples: readonly HcSleep[]): Map<string, HcSleep> {
  const out = new Map<string, HcSleep>()
  for (const s of samples) {
    const mins = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60_000
    if (mins < MIN_SLEEP_MINUTES) continue
    const day = localDate(s.endDate)
    const cur = out.get(day)
    const curMins = cur ? (new Date(cur.endDate).getTime() - new Date(cur.startDate).getTime()) / 60_000 : 0
    if (!cur || mins > curMins) out.set(day, s)
  }
  return out
}

export function sleepRow(day: string, s: HcSleep) {
  const stages = s.stages ?? []
  const of = (n: string) => stages.filter(x => x.stage === n).reduce((a, x) => a + x.durationMinutes, 0)
  const total = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60_000
  const detail = stages.length ? ` · deep ${fmtMinutes(of('deep'))} · REM ${fmtMinutes(of('rem'))}` : ''
  return {
    sleep_date:  day,
    bedtime:     localClock(s.startDate),
    wake_time:   localClock(s.endDate),
    quality:     sleepQuality(s),
    notes:       `${fmtMinutes(total)}${detail} · from Samsung Health`,
    source:      'health_connect',
    external_id: s.platformId ?? `sleep:${s.startDate}`,
  }
}
