// Pure builders for reminder notifications — no I/O, so the cron route stays
// a thin data-gathering layer and the wording logic is easy to verify.

export interface ReminderHabit {
  id:           string
  habit_name:   string
  streak_count: number
  is_keystone:  boolean
  // True when the streak is still alive going into today (last done
  // yesterday), so skipping today would actually break it.
  streakAlive:  boolean
  // The user's own "what skipping this costs me" (or, failing that, "what
  // it gives me") — quoted back at the moment of choice.
  leverage?:    string | null
}

export interface ReminderInput {
  pending:       ReminderHabit[]   // today's daily habits not yet logged
  doneCount:     number
  todoTitles:    string[]          // open tasks due today or earlier
  isEvening:     boolean
  perfectStreak: number            // live perfect-day streak (0 if broken)
  powerPending?: boolean           // this half of the day's power questions not done yet
}

export interface ReminderMessage {
  title: string
  body:  string
  url:   string
  tag:   string
  // Lets the notification offer a one-tap "mark done" action for this habit.
  actionHabit?: { id: string; name: string }
}

// The dashboard holds both the one-tap Today's Habits card and Power Questions.
export const HABITS_URL = '/dashboard'

// Keystone first, then the longest live streak — the habit most worth
// protecting is the one offered as the notification's one-tap action.
export function prioritize(pending: ReminderHabit[]): ReminderHabit[] {
  return [...pending].sort((a, b) =>
    Number(b.is_keystone) - Number(a.is_keystone) ||
    (b.streakAlive ? b.streak_count : 0) - (a.streakAlive ? a.streak_count : 0)
  )
}

function listNames(habits: ReminderHabit[], max = 3): string {
  const names = habits.slice(0, max).map(h => h.habit_name)
  const extra = habits.length - names.length
  return extra > 0 ? `${names.join(', ')} +${extra} more` : names.join(', ')
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function taskLine(todoTitles: string[]): string {
  if (!todoTitles.length) return ''
  if (todoTitles.length === 1) return `Task due: ${todoTitles[0]}.`
  return `${plural(todoTitles.length, 'task')} due today.`
}

function topAtRisk(pending: ReminderHabit[]): ReminderHabit | undefined {
  return pending
    .filter(h => h.streakAlive && h.streak_count > 0)
    .sort((a, b) => b.streak_count - a.streak_count)[0]
}

export function buildReminder(input: ReminderInput): ReminderMessage {
  const msg = buildHabitReminder(input)
  if (!input.powerPending) return msg
  const half = input.isEvening ? 'evening' : 'morning'
  return { ...msg, body: `${msg.body} Then 2 min of ${half} power questions.`, url: HABITS_URL }
}

function buildHabitReminder(input: ReminderInput): ReminderMessage {
  const pending = prioritize(input.pending)
  const first   = pending[0]
  const tasks   = taskLine(input.todoTitles)
  const tag     = 'zenith-reminder'

  if (!pending.length) {
    if (input.doneCount > 0) {
      return {
        title: input.isEvening ? 'All habits done today 🎉' : 'Habits already done 🎉',
        body:  [input.perfectStreak > 0 ? `Perfect-day streak: ${input.perfectStreak}.` : '', tasks || 'Nothing else due — enjoy it.']
          .filter(Boolean).join(' '),
        url:   tasks ? '/todos' : HABITS_URL,
        tag,
      }
    }
    return {
      title: input.isEvening ? 'Evening check-in 🌙' : 'Good morning 🌅',
      body:  tasks || 'Your tasks are clear today. Keep the momentum going!',
      url:   '/todos',
      tag,
    }
  }

  const actionHabit = { id: first.id, name: first.habit_name }
  const atRisk = topAtRisk(pending)

  if (input.isEvening) {
    const title = atRisk
      ? `🔥 ${atRisk.streak_count}-day ${atRisk.habit_name} streak at risk`
      : `${plural(pending.length, 'habit')} left today`
    const perfect = input.perfectStreak > 0
      ? ` Finish to keep your ${input.perfectStreak}-day perfect streak.`
      : ''
    return {
      title,
      body: `Left: ${listNames(pending)}.${perfect}${tasks ? ` ${tasks}` : ''}`,
      url:  HABITS_URL,
      tag,
      // The button must log the habit the title is warning about.
      actionHabit: atRisk ? { id: atRisk.id, name: atRisk.habit_name } : actionHabit,
    }
  }

  const streakNote = first.streakAlive && first.streak_count > 0 ? ` (🔥 ${first.streak_count})` : ''
  return {
    title: `${plural(pending.length, 'habit')} today`,
    body:  `Start with ${first.habit_name}${streakNote}.${pending.length > 1 ? ` Then: ${listNames(pending.slice(1), 2)}.` : ''}${tasks ? ` ${tasks}` : ''}`,
    url:   HABITS_URL,
    tag,
    actionHabit,
  }
}

// Late-evening last call, sent only when a live streak would break tonight.
// Returns null when there's nothing at stake, so no generic nag goes out.
export function buildStreakRiskNudge(pendingHabits: ReminderHabit[]): ReminderMessage | null {
  const pending = prioritize(pendingHabits)
  const atRisk  = topAtRisk(pending)
  if (!atRisk) return null
  const others = pending.length - 1
  return {
    title: `Last call: ${atRisk.streak_count}-day streak 🔥`,
    body:  atRisk.leverage?.trim()
      ? `${atRisk.habit_name} isn't logged yet. You said: "${atRisk.leverage.trim()}"`
      : `${atRisk.habit_name} isn't logged yet${others > 0 ? ` (plus ${plural(others, 'other habit')})` : ''}. One tap keeps it alive.`,
    url:   HABITS_URL,
    tag:   'zenith-streak-risk',
    actionHabit: { id: atRisk.id, name: atRisk.habit_name },
  }
}

// Which configured reminder times are due right now. A time is due if it
// passed within the last `windowMins` minutes and hasn't been sent for the
// calendar day it belongs to — a 23:50 reminder picked up at 00:05 still
// belongs to the previous day, so it's tracked against that date.
export function dueReminderTimes(
  reminderTimes: string[],
  sentToday: Record<string, string>,
  now: { minutes: number; dateStr: string; yesterdayStr: string },
  windowMins = 60,
): { time: string; date: string }[] {
  const due: { time: string; date: string }[] = []
  for (const t of reminderTimes) {
    const [rh, rm] = t.split(':').map(Number)
    if (Number.isNaN(rh) || Number.isNaN(rm)) continue
    const reminderMins = rh * 60 + rm
    const wrapped = now.minutes < reminderMins
    const since   = wrapped ? now.minutes + 1440 - reminderMins : now.minutes - reminderMins
    if (since > windowMins) continue
    const date = wrapped ? now.yesterdayStr : now.dateStr
    if (sentToday[t] !== date) due.push({ time: t, date })
  }
  return due
}
