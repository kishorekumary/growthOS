import { describe, it, expect } from 'vitest'
import {
  patternById, patternCountsLabel, phasesOf, cyclesFor, sessionTimeline, formatClock,
} from '@/lib/breathing'

describe('breathing patterns', () => {
  it('labels counts, dropping trailing holds of zero', () => {
    expect(patternCountsLabel(patternById('box'))).toBe('4-4-4-4')
    expect(patternCountsLabel(patternById('relax'))).toBe('4-7-8')
    expect(patternCountsLabel(patternById('coherent'))).toBe('5-5')
  })

  it('skips zero-length holds', () => {
    expect(phasesOf(patternById('coherent')).map(p => p.kind)).toEqual(['inhale', 'exhale'])
    expect(phasesOf(patternById('relax')).map(p => p.kind)).toEqual(['inhale', 'hold', 'exhale'])
  })

  it('falls back to box for an unknown id', () => {
    expect(patternById('nope').id).toBe('box')
    expect(patternById(null).id).toBe('box')
  })
})

describe('session length', () => {
  it('rounds to whole cycles near the chosen minutes', () => {
    expect(cyclesFor(patternById('box'), 2)).toBe(8)      // 16s cycles → 128s
    expect(cyclesFor(patternById('relax'), 1)).toBe(3)    // 19s cycles → 57s
    expect(cyclesFor(patternById('coherent'), 5)).toBe(30)
  })

  it('always runs at least one cycle', () => {
    expect(cyclesFor(patternById('relax'), 0)).toBe(1)
  })

  it('builds one step per second, cueing each phase once', () => {
    const steps = sessionTimeline(patternById('box'), 1)
    expect(steps).toHaveLength(4 * 16)
    expect(steps.slice(0, 5).map(s => [s.phaseIndex, s.remaining, s.starts])).toEqual([
      [0, 4, true], [0, 3, false], [0, 2, false], [0, 1, false], [1, 4, true],
    ])
    expect(steps.filter(s => s.starts)).toHaveLength(4 * 4)
    expect(steps[steps.length - 1]).toMatchObject({ phaseIndex: 3, remaining: 1, cycle: 3 })
  })
})

describe('formatClock', () => {
  it('formats m:ss', () => {
    expect(formatClock(125)).toBe('2:05')
    expect(formatClock(0)).toBe('0:00')
  })
})
