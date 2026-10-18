import { describe, expect, it } from 'vitest'
import { averageClock, topRepeats, usualWorkout } from '@/lib/logDefaults'

describe('averageClock', () => {
  it('averages across midnight', () => {
    expect(averageClock(['23:30', '00:30'])).toBe('00:00')
    expect(averageClock(['23:00', '23:20', '23:40'])).toBe('23:20')
  })
  it('rounds to 5 minutes and ignores blanks', () => {
    expect(averageClock(['06:31', null, '06:33'])).toBe('06:30')
  })
  it('is null with nothing to go on', () => expect(averageClock([])).toBeNull())
})

describe('topRepeats', () => {
  const rows = ['coffee', 'lunch', 'coffee', 'fuel', 'lunch', 'coffee', 'movie']
  it('ranks by frequency, ties to the most recent', () => {
    expect(topRepeats(rows, r => r, 3)).toEqual(['coffee', 'lunch', 'fuel'])
  })
})

describe('usualWorkout', () => {
  it('picks the most frequent type and its median length', () => {
    const rows = [
      { workout_type: 'strength', duration_mins: 45 },
      { workout_type: 'cardio', duration_mins: 30 },
      { workout_type: 'strength', duration_mins: 50 },
      { workout_type: 'rest', duration_mins: 0 },
      { workout_type: 'strength', duration_mins: 41 },
    ]
    expect(usualWorkout(rows)).toEqual({ workout_type: 'strength', duration_mins: 45 })
  })
  it('is null with no workouts', () => expect(usualWorkout([])).toBeNull())
})
