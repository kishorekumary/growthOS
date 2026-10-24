// Breathing patterns and session timing for Quick Reset's breathing exercise.
// A session is a whole number of cycles, so it always ends after an exhale
// (or the hold after it) instead of cutting off mid-breath.

export type BreathKind = 'inhale' | 'hold' | 'exhale'

export interface BreathPhase {
  kind:    BreathKind
  label:   string
  seconds: number
}

export interface BreathPattern {
  id:     string
  name:   string
  // Seconds for inhale · hold · exhale · hold; a 0 hold is skipped.
  counts: [number, number, number, number]
  blurb:  string
}

export const BREATH_PATTERNS: BreathPattern[] = [
  { id: 'box',      name: 'Box',      counts: [4, 4, 4, 4], blurb: 'Steady focus under pressure' },
  { id: 'calm',     name: 'Calm',     counts: [4, 4, 6, 4], blurb: 'Longer exhale to unwind' },
  { id: 'relax',    name: '4-7-8',    counts: [4, 7, 8, 0], blurb: 'Deep relaxation, before sleep' },
  { id: 'coherent', name: 'Coherent', counts: [5, 0, 5, 0], blurb: 'Even, flowing breath — no holds' },
]

export const SESSION_MINUTES = [1, 2, 5, 10] as const

export const DEFAULT_PATTERN_ID = 'box'
export const DEFAULT_MINUTES    = 2

export function patternById(id: string | null | undefined): BreathPattern {
  return BREATH_PATTERNS.find(p => p.id === id) ?? BREATH_PATTERNS[0]
}

// "4-4-4-4", or "5-5" when the pattern has no holds.
export function patternCountsLabel(p: BreathPattern): string {
  return p.counts.filter((n, i) => n > 0 || i % 2 === 0).join('-')
}

export function phasesOf(p: BreathPattern): BreathPhase[] {
  const [inhale, hold1, exhale, hold2] = p.counts
  const all: BreathPhase[] = [
    { kind: 'inhale', label: 'Inhale', seconds: inhale },
    { kind: 'hold',   label: 'Hold',   seconds: hold1  },
    { kind: 'exhale', label: 'Exhale', seconds: exhale },
    { kind: 'hold',   label: 'Hold',   seconds: hold2  },
  ]
  return all.filter(ph => ph.seconds > 0)
}

export function cycleSeconds(p: BreathPattern): number {
  return p.counts.reduce((a, b) => a + b, 0)
}

// Cycles closest to the chosen length, at least one.
export function cyclesFor(p: BreathPattern, minutes: number): number {
  return Math.max(1, Math.round((minutes * 60) / cycleSeconds(p)))
}

export interface BreathStep {
  phaseIndex: number
  // Seconds left in this phase, counting down to 1.
  remaining:  number
  // First second of a phase — when its cue plays.
  starts:     boolean
  cycle:      number
}

// One entry per second of the whole session.
export function sessionTimeline(p: BreathPattern, minutes: number): BreathStep[] {
  const phases = phasesOf(p)
  const steps: BreathStep[] = []
  const cycles = cyclesFor(p, minutes)
  for (let cycle = 0; cycle < cycles; cycle++) {
    phases.forEach((ph, phaseIndex) => {
      for (let s = 0; s < ph.seconds; s++) {
        steps.push({ phaseIndex, remaining: ph.seconds - s, starts: s === 0, cycle })
      }
    })
  }
  return steps
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
