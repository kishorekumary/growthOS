// Morning and evening "power questions", after Tony Robbins' Awaken the
// Giant Within: the questions you habitually ask yourself decide what you
// focus on, and so how you feel. Sessions are saved as tagged journal
// entries; this module is pure (no I/O) so the rules are easy to verify.

export type PowerKind = 'morning' | 'evening'

export const POWER_TAG: Record<PowerKind, string> = {
  morning: 'power-morning',
  evening: 'power-evening',
}
export const POWER_POINTS = 10   // per completed session, once per kind per day
export const POWER_TITLE: Record<PowerKind, string> = {
  morning: 'Morning Power Questions',
  evening: 'Evening Power Questions',
}

export const MORNING_QUESTIONS = [
  'What am I happy about in my life right now?',
  'What am I excited about in my life right now?',
  'What am I proud of in my life right now?',
  'What am I grateful for in my life right now?',
  'What am I enjoying most in my life right now?',
  'What am I committed to in my life right now?',
  'Who do I love? Who loves me?',
]
// Asked alongside each morning question: the point is to feel it, not list it.
export const MORNING_FOLLOW_UP = 'What about that makes me feel this way? How does it feel?'

// The first three are Robbins' evening set; the rest fold in the workbook's
// Daily Review, so the day closes with one ritual instead of two.
export const EVENING_QUESTIONS = [
  'What have I given today? In what ways have I been a giver?',
  'What did I learn today?',
  'How has today added to the quality of my life? How can I use today as an investment in my future?',
  'What did I do well today?',
  'Where did I act against my values? What could I have handled better?',
  'What am I grateful for today?',
  'What is the most important action for tomorrow?',
]

// Morning set until 4 PM local, evening after — the card opens on whichever
// fits, and the other stays one tap away.
export function defaultKind(hour: number): PowerKind {
  return hour >= 4 && hour < 16 ? 'morning' : 'evening'
}

// An extra evening question tied to today's habits, so the ritual connects
// to what you actually did. Null when there are no daily habits to talk about.
export function eveningHabitQuestion(done: string[], missed: string[]): string | null {
  if (!done.length && !missed.length) return null
  if (!missed.length) return 'Every habit done today. What made that possible, and how do you make tomorrow the same?'
  const habit = missed[0]
  if (!done.length) return `What got in the way of ${habit} today, and what will you decide to do differently tomorrow?`
  return `You showed up for ${done[0]} today but not ${habit}. What is the difference, and what will you change tomorrow?`
}

// Consecutive days with at least one session, counting back from today —
// or from yesterday if today has none yet, so the streak isn't shown as
// broken before the user has had a chance to do today's.
export function powerStreak(sessionDates: string[], today: string, yesterday: string): number {
  const days = new Set(sessionDates)
  let cursor = days.has(today) ? today : yesterday
  let streak = 0
  while (days.has(cursor)) {
    streak++
    const d = new Date(`${cursor}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    cursor = d.toISOString().slice(0, 10)
  }
  return streak
}

export interface QA { question: string; answer: string }

// Journal entries are plain text; keep only answered questions.
export function formatSession(qa: QA[]): string {
  return qa
    .filter(x => x.answer.trim())
    .map(x => `${x.question}\n${x.answer.trim()}`)
    .join('\n\n')
}
