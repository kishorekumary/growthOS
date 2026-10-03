// One short reflective question a day, picked from yesterday's habit
// results so it feels personal. Rule-based on purpose: instant, free, and
// works offline. Deterministic per date, so the question doesn't change
// on reload.

export interface YesterdaySummary {
  done:   string[]   // habit names completed yesterday
  missed: string[]   // daily habits not done (skipped or never logged)
}

export const DAILY_QUESTION_TAG    = 'daily-question'
export const DAILY_QUESTION_POINTS = 5

const PERFECT = [
  'Yesterday was a perfect day. What made it work, and how do you repeat it today?',
  'Every habit done yesterday. Which one felt easiest, and why?',
  'You were fully consistent yesterday. What would make today even better?',
]
const MISSED = [
  'What got in the way of {habit} yesterday, and what is one small change for today?',
  'If you could redo yesterday, when would you have fit in {habit}?',
  'What is the smallest version of {habit} you could do today, even on a bad day?',
]
const PARTIAL = [
  'You did {done} yesterday. What helped you show up for it?',
  'Which habit from yesterday gave you the most energy afterwards?',
]
const GENERAL = [
  'What is one thing you want to be proud of by tonight?',
  'What drained your energy yesterday, and how can you avoid it today?',
  'Who or what are you grateful for this morning?',
  'What is one thing you are avoiding? What is the first tiny step?',
  'What would make today a 10 out of 10?',
  'What did you learn about yourself this week?',
  'Which habit matters most to the person you are becoming, and why?',
]

// Stable small hash of the date string, so picks vary day to day.
function daySeed(dateStr: string): number {
  let h = 0
  for (const c of dateStr) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length]
}

export function dailyQuestion(dateStr: string, y: YesterdaySummary): string {
  const seed  = daySeed(dateStr)
  const total = y.done.length + y.missed.length
  // Every third day a general question, so it doesn't feel like a report card.
  if (total === 0 || seed % 3 === 0) return pick(GENERAL, seed >>> 2)
  if (y.missed.length === 0) return pick(PERFECT, seed >>> 2)
  if (y.done.length === 0 || seed % 2 === 0) {
    return pick(MISSED, seed >>> 2).replace('{habit}', pick(y.missed, seed >>> 4))
  }
  return pick(PARTIAL, seed >>> 2).replace('{done}', pick(y.done, seed >>> 4))
}
