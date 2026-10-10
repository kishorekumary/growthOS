// The personal-growth workbook: guided written exercises (in the spirit of
// Awaken the Giant Within). One-time exercises run as a program — a new one
// each day, in order — while the reviews recur weekly or monthly. Sessions
// are saved as tagged journal entries, so "what's due" is derived from the
// journal alone. Pure module (no I/O) so the scheduling rules are easy to verify.
//
// The Daily Review isn't here: its questions live in the evening power
// questions (src/lib/powerQuestions.ts), so the day closes with one ritual.

export type Cadence = 'once' | 'weekly' | 'monthly'

export interface Exercise {
  slug:      string
  title:     string
  theme:     string
  cadence:   Cadence
  intro?:    string
  questions: string[]
}

export const WORKBOOK_TAG   = 'workbook'
export const WORKBOOK_POINTS = 15   // per exercise, once per exercise per day
export const exerciseTag = (slug: string) => `exercise:${slug}`

export const THEMES = [
  'Decisions & Standards',
  'Beliefs & Identity',
  'Emotions',
  'Values & Rules',
  'Vision & Outcomes',
  'Reviews',
  'Rehearsal & Environment',
] as const

export const EXERCISES: Exercise[] = [
  {
    slug: 'decision-audit', title: 'The Decision Audit', theme: 'Decisions & Standards', cadence: 'once',
    questions: [
      'Which area of my life do I genuinely want to change?',
      'What have I been doing in that area, and why hasn\'t it worked?',
      'What will it cost me to keep doing this for three more years?',
      'What are the benefits of changing now?',
      'What one small action would prove my commitment?',
      'Complete: I am no longer willing to accept ___.',
      'Complete: I am committed to becoming someone who ___.',
    ],
  },
  {
    slug: 'pain-and-pleasure', title: 'The Pain and Pleasure Exercise', theme: 'Decisions & Standards', cadence: 'once',
    questions: [
      'Which behavior is holding me back?',
      'What immediate pleasure do I get from continuing it?',
      'What short-term pain comes with changing it?',
      'What is the long-term pain of continuing it?',
      'What are the long-term pleasure and benefits of changing it?',
      'What new behavior would make the better option easier?',
    ],
  },
  {
    slug: 'personal-standards', title: 'My Personal Standards', theme: 'Decisions & Standards', cadence: 'once',
    questions: [
      'What do I currently tolerate in my health, work, relationships and habits?',
      'What standard do I want to keep in each of those areas?',
      'Where do my actions fall below those standards?',
      'Which one standard will I raise this week?',
      'What is the minimum action that keeps that standard on difficult days?',
    ],
  },
  {
    slug: 'clear-decision', title: 'The Power of a Clear Decision', theme: 'Decisions & Standards', cadence: 'once',
    questions: [
      'What decision have I been postponing?',
      'What information do I still need?',
      'Which obstacles are genuine, and which are excuses or fear?',
      'What is my deadline for making the decision?',
      'What is the first action, and when will I take it?',
    ],
  },
  {
    slug: 'pattern-interrupt', title: 'My Pattern-Interrupt Exercise', theme: 'Emotions', cadence: 'once',
    intro: 'Pick a reaction you can watch for over the next few days, then come back and finish the last questions.',
    questions: [
      'What recurring unhelpful reaction have I noticed?',
      'What is the trigger, and what is my usual response?',
      'How will I pause before repeating the response?',
      'How will I safely change my posture, breathing or attention in that moment?',
      'What more useful response will I choose?',
      'What happened when I tried it, and what did I learn?',
    ],
  },
  {
    slug: 'limiting-beliefs', title: 'Limiting Beliefs Audit', theme: 'Beliefs & Identity', cadence: 'once',
    questions: [
      'What do I believe about myself that may be limiting me?',
      'Where did this belief originate?',
      'What experiences seem to support it?',
      'What evidence contradicts it?',
      'What has believing this cost me?',
      'What would change if I no longer accepted it as true?',
      'What more accurate and empowering belief could I adopt?',
      'What action would demonstrate this new belief?',
    ],
  },
  {
    slug: 'belief-reinforcement', title: 'Belief-Reinforcement Exercise', theme: 'Beliefs & Identity', cadence: 'once',
    questions: [
      'What belief supports the person I want to become?',
      'What are three reasons it is useful?',
      'Which real experiences support it?',
      'What short reminder or affirmation captures it?',
      'What one action will I take today that reinforces it?',
      'When will I review this belief, and what evidence would make me adjust it?',
    ],
  },
  {
    slug: 'identity-audit', title: 'Identity Audit', theme: 'Beliefs & Identity', cadence: 'once',
    questions: [
      'How do I currently describe myself?',
      'Which labels have become self-fulfilling?',
      'Which labels do I want to stop using?',
      'What qualities do I want to embody?',
      'What would a person with those qualities do today?',
      'Which small action will reinforce that identity?',
    ],
  },
  {
    slug: 'emotional-trigger', title: 'Emotional Trigger Analysis', theme: 'Emotions', cadence: 'once',
    questions: [
      'What happened?',
      'What meaning did I assign to the event?',
      'What emotion did I experience?',
      'What did I feel like doing?',
      'What did I actually do?',
      'What alternative interpretation is reasonable?',
      'What response would better serve my values?',
    ],
  },
  {
    slug: 'reframing', title: 'Reframing an Experience', theme: 'Emotions', cadence: 'once',
    questions: [
      'Describe a frustrating experience objectively.',
      'Which interpretation made it painful?',
      'What can I learn from it?',
      'What is another plausible interpretation?',
      'What remains within my control?',
      'What constructive next action will I choose?',
    ],
  },
  {
    slug: 'core-values', title: 'Core Values Clarification', theme: 'Values & Rules', cadence: 'once',
    questions: [
      'What matters most to me in life?',
      'Which values do I want to embody rather than merely possess?',
      'Rank my five most important values.',
      'How do these values influence my daily decisions?',
      'Where am I acting against them?',
      'What change would bring my behavior into alignment?',
    ],
  },
  {
    slug: 'values-conflict', title: 'Values Conflict Audit', theme: 'Values & Rules', cadence: 'once',
    questions: [
      'Which two of my values sometimes compete?',
      'Describe a recent situation where they clashed.',
      'Which value dominated my decision?',
      'What was the consequence?',
      'How could I honor both values better next time?',
    ],
  },
  {
    slug: 'personal-rules', title: 'Personal Rules Audit', theme: 'Values & Rules', cadence: 'once',
    questions: [
      'What conditions must be met before I let myself feel successful?',
      'Which of these rules are unnecessarily difficult to satisfy?',
      'Which depend on circumstances outside my control?',
      'What healthier, more realistic rules could I set?',
      'How can I recognize progress without demanding perfection?',
    ],
  },
  {
    slug: 'life-vision', title: 'Life Vision Exercise', theme: 'Vision & Outcomes', cadence: 'once',
    questions: [
      'Describe my ideal life three years from now.',
      'What do I want my health to look like?',
      'What kind of work and leadership do I want to pursue?',
      'What relationships do I want to nurture?',
      'What financial position do I want to build?',
      'What kind of person do I want to become?',
      'Which parts of this vision matter most, and why?',
    ],
  },
  {
    slug: 'life-areas', title: 'Life Areas Assessment', theme: 'Reviews', cadence: 'monthly',
    intro: 'Rate each area from 1 to 10, then dig into your three lowest.',
    questions: [
      'Physical health and energy: 1–10?',
      'Emotional wellbeing: 1–10?',
      'Family and relationships: 1–10?',
      'Career and leadership: 1–10?',
      'Financial wellbeing: 1–10?',
      'Learning and intellectual growth: 1–10?',
      'Purpose and meaning: 1–10?',
      'Spirituality or inner awareness: 1–10?',
      'Recreation and enjoyment: 1–10?',
      'For my three lowest-rated areas: what is the main issue in each?',
      'What in those areas is within my control?',
      'What one improvement will I make in each this month?',
    ],
  },
  {
    slug: 'outcome-definition', title: 'Outcome Definition', theme: 'Vision & Outcomes', cadence: 'once',
    questions: [
      'What exactly do I want to achieve?',
      'Why does this outcome matter?',
      'How will I measure progress?',
      'What is my deadline?',
      'What resources or skills do I need?',
      'Which obstacles are likely?',
      'What is my first action?',
    ],
  },
  {
    slug: 'outcome-to-action', title: 'Outcome-to-Action Plan', theme: 'Vision & Outcomes', cadence: 'once',
    questions: [
      'What is the desired result?',
      'Which actions are most likely to produce it?',
      'Which of those are daily actions, and which are weekly milestones?',
      'When is the first action scheduled?',
      'How will I track progress?',
      'When will I review results and adjust my approach?',
    ],
  },
  {
    slug: 'obstacle-planning', title: 'Obstacle and Contingency Planning', theme: 'Vision & Outcomes', cadence: 'once',
    questions: [
      'What usually causes me to abandon my plans?',
      'Which situations trigger this?',
      'What will I do when the obstacle appears?',
      'What is my minimum viable action on a difficult day?',
      'How will I restart after missing a day?',
    ],
  },
  {
    slug: 'weekly-review', title: 'Weekly Review', theme: 'Reviews', cadence: 'weekly',
    questions: [
      'What meaningful progress did I make this week?',
      'Which habits were consistent?',
      'What repeatedly distracted me?',
      'Which goal needs adjustment?',
      'What should I stop, start and continue?',
      'What is my primary focus for the coming week?',
    ],
  },
  {
    slug: 'mental-rehearsal', title: 'Mental Rehearsal', theme: 'Rehearsal & Environment', cadence: 'once',
    intro: 'Rehearse before the situation; answer the last question after it happens.',
    questions: [
      'Which upcoming situation do I want to perform well in?',
      'Visualize it realistically. What do I see?',
      'Which actions do I intend to take? Rehearse them.',
      'What likely obstacle could come up, and how will I respond?',
      'What is the first physical action I will perform?',
      'Afterward: what was the actual outcome?',
    ],
  },
  {
    slug: 'affirmation-to-action', title: 'Affirmation-to-Action Exercise', theme: 'Rehearsal & Environment', cadence: 'once',
    questions: [
      'Write one meaningful affirmation.',
      'What observable behavior does it translate into?',
      'When and where will I perform that behavior?',
      'I will repeat the affirmation while preparing to act. What does saying it feel like?',
      'How will I track whether the behavior actually happened?',
    ],
  },
  {
    slug: 'positive-association', title: 'Positive Association Audit', theme: 'Rehearsal & Environment', cadence: 'once',
    questions: [
      'Which important habit do I tend to avoid?',
      'Why do I associate it with discomfort?',
      'What meaningful benefit does doing it give me?',
      'How can I make the starting step easier?',
      'How will I reward consistency in a healthy way?',
      'When will I review whether the new association improves my follow-through?',
    ],
  },
  {
    slug: 'environment-design', title: 'Environment Design', theme: 'Rehearsal & Environment', cadence: 'once',
    questions: [
      'Which cues in my environment trigger unwanted habits?',
      'Which of those cues can I remove or reduce?',
      'How can I make desired behaviors easier to begin?',
      'Which tools or materials can I prepare in advance?',
      'Whom could I ask for support?',
      'What will I check when I review my environment in a week?',
    ],
  },
  {
    slug: 'commitment-review', title: 'Personal Commitment Review', theme: 'Reviews', cadence: 'weekly',
    questions: [
      'Which decision am I reinforcing?',
      'What evidence shows that my behavior is changing?',
      'Which situations still challenge me?',
      'What adjustment would help?',
      'What commitment will I carry into next week?',
    ],
  },
]

export const PROGRAM = EXERCISES.filter(e => e.cadence === 'once')

export function findExercise(slug: string): Exercise | undefined {
  return EXERCISES.find(e => e.slug === slug)
}

export interface WorkbookSession { entry_date: string; tags: string[] | null }

const slugOf = (tag: string) => tag.startsWith('exercise:') ? tag.slice('exercise:'.length) : null

// Last completed date per exercise slug.
export function lastDone(sessions: WorkbookSession[]): Map<string, string> {
  const last = new Map<string, string>()
  for (const s of sessions) {
    for (const tag of s.tags ?? []) {
      const slug = slugOf(tag)
      if (slug && (last.get(slug) ?? '') < s.entry_date) last.set(slug, s.entry_date)
    }
  }
  return last
}

// The most recent Sunday on or before `today` (YYYY-MM-DD, calendar math only).
function weekStart(today: string): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.toISOString().slice(0, 10)
}

export interface WorkbookStatus {
  // Next program exercise to do (null when the program is finished).
  next:          Exercise | null
  // True when a program exercise was already done today — one per day.
  programDoneToday: boolean
  programDone:   number
  // Recurring reviews due now: weekly ones from Sunday until done that
  // week, the monthly one from the 1st until done that month. They start
  // with the first full week/month after the user's first exercise, so day
  // one is just the first program exercise.
  recurringDue:  Exercise[]
  // Everything to nudge about today, in order.
  due:           Exercise[]
}

export function workbookStatus(sessions: WorkbookSession[], today: string): WorkbookStatus {
  const last = lastDone(sessions)
  const programDoneToday = PROGRAM.some(e => last.get(e.slug) === today)
  const next = PROGRAM.find(e => !last.has(e.slug)) ?? null
  const sunday = weekStart(today)
  const month  = today.slice(0, 7)
  const first  = sessions.reduce<string | null>((min, s) => !min || s.entry_date < min ? s.entry_date : min, null)
  const recurringDue = EXERCISES.filter(e => {
    const done = last.get(e.slug)
    if (!first) return false
    if (e.cadence === 'weekly')  return first < sunday && (!done || done < sunday)
    if (e.cadence === 'monthly') return first.slice(0, 7) < month && (!done || done.slice(0, 7) < month)
    return false
  })
  return {
    next,
    programDoneToday,
    programDone: PROGRAM.filter(e => last.has(e.slug)).length,
    recurringDue,
    due: [...recurringDue, ...(next && !programDoneToday ? [next] : [])],
  }
}
