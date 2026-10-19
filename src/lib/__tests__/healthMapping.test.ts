import { describe, expect, it } from 'vitest'
import { mapWorkoutType, nightlySleep, sleepQuality, sleepRow, workoutLabel, workoutRow } from '@/lib/health/mapping'

// Local times (tests run with TZ=America/New_York).
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString()

describe('workouts', () => {
  it('maps Health Connect types onto app types', () => {
    expect(mapWorkoutType('running')).toBe('cardio')
    expect(mapWorkoutType('highIntensityIntervalTraining')).toBe('cardio')
    expect(mapWorkoutType('traditionalStrengthTraining')).toBe('strength')
    expect(mapWorkoutType('weightlifting')).toBe('strength')
    expect(mapWorkoutType('yoga')).toBe('yoga')
    expect(mapWorkoutType('pilates')).toBe('yoga')
    expect(mapWorkoutType('badminton')).toBe('sports')
    expect(mapWorkoutType('cricket')).toBe('sports')
    expect(mapWorkoutType('other')).toBe('cardio')
  })
  it('labels and summarises', () => {
    expect(workoutLabel('highIntensityIntervalTraining')).toBe('High intensity interval training')
    const row = workoutRow({ workoutType: 'running', duration: 1830, totalDistance: 5230, totalEnergyBurned: 321.6, startDate: at(18, 7), endDate: at(18, 7, 30), platformId: 'hc-1' })
    expect(row).toMatchObject({ log_date: '2026-10-18', workout_type: 'cardio', duration_mins: 31, external_id: 'hc-1', source: 'health_connect' })
    expect(row.notes).toBe('Running · 5.2 km · 322 kcal · from Samsung Health')
  })
})

describe('sleep', () => {
  const night = { value: 450, startDate: at(17, 23, 10), endDate: at(18, 6, 40), platformId: 's1' }
  it('credits the night to the wake-up day and ignores naps', () => {
    const nap = { value: 60, startDate: at(18, 14), endDate: at(18, 15) }
    const m = nightlySleep([night, nap])
    expect(Array.from(m.keys())).toEqual(['2026-10-18'])
    expect(m.get('2026-10-18')?.platformId).toBe('s1')
  })
  it('scores quality from stages', () => {
    const great = { ...night, stages: [
      { stage: 'light', durationMinutes: 220 }, { stage: 'deep', durationMinutes: 100 },
      { stage: 'rem', durationMinutes: 110 }, { stage: 'awake', durationMinutes: 20 }] }
    const poor = { ...night, stages: [
      { stage: 'light', durationMinutes: 300 }, { stage: 'deep', durationMinutes: 20 },
      { stage: 'awake', durationMinutes: 130 }] }
    expect(sleepQuality(great)).toBeGreaterThanOrEqual(4)
    expect(sleepQuality(poor)).toBeLessThanOrEqual(2)
  })
  it('builds the sleep row', () => {
    const row = sleepRow('2026-10-18', { ...night, stages: [{ stage: 'deep', durationMinutes: 80 }, { stage: 'rem', durationMinutes: 95 }, { stage: 'light', durationMinutes: 275 }] })
    expect(row).toMatchObject({ sleep_date: '2026-10-18', bedtime: '23:10', wake_time: '06:40', external_id: 's1' })
    expect(row.notes).toBe('7h 30m · deep 1h 20m · REM 1h 35m · from Samsung Health')
  })
})
