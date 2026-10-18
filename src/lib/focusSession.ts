// Display math for a running focus sequence (FocusTimer's run view).

export interface FocusStep { label: string; duration: number }

export type StepTone = 'focus' | 'break'

// Breaks get a calmer colour. Matched on the step's own name, since
// sequences are free-form ("Short break", "Stretch", "Walk", "Lunch").
const BREAK_WORDS = /\b(break|rest|relax|stretch|walk|breathe|breathing|lunch|pause|recover|nap|tea|coffee)\b/i

export function stepTone(label: string): StepTone {
  return BREAK_WORDS.test(label) ? 'break' : 'focus'
}

export interface SessionSegment { share: number; filled: number; tone: StepTone }

export interface SessionProgress {
  total:     number            // seconds in the whole sequence
  remaining: number            // seconds left including the current step
  segments:  SessionSegment[]  // one per step: width share (0–1) and how full (0–1)
}

export function sessionProgress(steps: readonly FocusStep[], stepIdx: number, secondsLeft: number): SessionProgress {
  const total = steps.reduce((s, x) => s + x.duration, 0)
  const later = steps.slice(stepIdx + 1).reduce((s, x) => s + x.duration, 0)
  const remaining = Math.max(0, secondsLeft) + later
  const segments = steps.map((s, i) => ({
    share:  total ? s.duration / total : 0,
    filled: i < stepIdx ? 1 : i > stepIdx ? 0 : s.duration ? Math.min(1, Math.max(0, 1 - secondsLeft / s.duration)) : 1,
    tone:   stepTone(s.label),
  }))
  return { total, remaining, segments }
}

// Minutes spent on focus (non-break) steps — for the completion summary.
export function focusMinutes(steps: readonly FocusStep[]): number {
  return Math.round(steps.filter(s => stepTone(s.label) === 'focus').reduce((a, s) => a + s.duration, 0) / 60)
}
