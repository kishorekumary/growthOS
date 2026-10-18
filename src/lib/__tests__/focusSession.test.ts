import { describe, expect, it } from 'vitest'
import { focusMinutes, sessionProgress, stepTone } from '@/lib/focusSession'

const steps = [
  { label: 'Deep work', duration: 1500 },
  { label: 'Short break', duration: 300 },
  { label: 'Deep work', duration: 1500 },
  { label: 'Stretch', duration: 300 },
]

describe('stepTone', () => {
  it('spots breaks by name', () => {
    expect(stepTone('Short break')).toBe('break')
    expect(stepTone('Walk & water')).toBe('break')
    expect(stepTone('Lunch')).toBe('break')
    expect(stepTone('Deep work')).toBe('focus')
    expect(stepTone('Breakfast planning')).toBe('focus')
  })
})

describe('sessionProgress', () => {
  it('sizes segments by duration and fills done / current steps', () => {
    const p = sessionProgress(steps, 1, 120)
    expect(p.total).toBe(3600)
    expect(p.segments.map(s => s.share)).toEqual([1500 / 3600, 300 / 3600, 1500 / 3600, 300 / 3600])
    expect(p.segments.map(s => s.filled)).toEqual([1, 0.6, 0, 0])
    expect(p.segments.map(s => s.tone)).toEqual(['focus', 'break', 'focus', 'break'])
  })

  it('counts the rest of the current step plus every later step', () => {
    expect(sessionProgress(steps, 1, 120).remaining).toBe(120 + 1500 + 300)
    expect(sessionProgress(steps, 3, 0).remaining).toBe(0)
  })
})

describe('focusMinutes', () => {
  it('leaves breaks out', () => expect(focusMinutes(steps)).toBe(50))
})
