// Approximate matching of spoken words to habit names, for voice logging.
// People don't say the exact habit name ("I meditated" for "Meditation",
// "finished reading my book" for "Book reading", "went for a jog" for
// "Morning run"), and speech recognition mishears words. So both sides are
// reduced to rough word stems, compared word by word with an edit-distance
// tolerance, and scored by how much of the habit name was said.

const STOPWORDS = new Set([
  'i', 'im', 'ive', 'me', 'my', 'a', 'an', 'the', 'to', 'for', 'of', 'and', 'or', 'with', 'on', 'in', 'at',
  'it', 'this', 'that', 'some', 'just', 'also', 'now', 'today', 'again', 'already', 'habit', 'mark', 'log',
  'logged', 'done', 'do', 'did', 'does', 'complete', 'completed', 'finish', 'finished', 'have', 'has', 'had',
  'was', 'is', 'am', 'got', 'went', 'go', 'minute', 'minutes', 'min', 'mins', 'hour', 'hours', 'time', 'times',
])

// Irregular verbs and everyday synonyms, mapped to a common stem.
const ALIASES: Record<string, string> = {
  ran: 'run', running: 'run', jog: 'run', jogged: 'run', jogging: 'run',
  wrote: 'writ', written: 'writ', writing: 'writ', write: 'writ',
  slept: 'sleep', sleeping: 'sleep', drank: 'drink', drunk: 'drink', ate: 'eat', eaten: 'eat',
  swam: 'swim', swimming: 'swim', exercised: 'exercis', workout: 'exercis', worked: 'exercis', gym: 'exercis',
  studied: 'study', studying: 'study', prayed: 'pray', praying: 'pray',
}

const SUFFIXES = ['ations', 'ation', 'ings', 'ing', 'edly', 'ed', 'es', 's', 'e']

function stem(word: string): string {
  if (ALIASES[word]) return ALIASES[word]
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length)
  }
  return word
}

export function habitTokens(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(stem)
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

// 1 for the same stem, 0.9 when one stem starts the other ("medit" /
// "meditat"), otherwise 1 − normalised edit distance.
function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.9
  return 1 - editDistance(a, b) / Math.max(a.length, b.length)
}

const WORD_MATCH = 0.75

// 0..1: mostly how much of the habit name was said, nudged by how much of
// what was said belongs to the habit (so a long sentence that happens to
// contain one shared word ranks below a closer phrase).
export function habitMatchScore(spoken: string, habitName: string): number {
  const said  = habitTokens(spoken)
  const habit = habitTokens(habitName)
  if (!said.length || !habit.length) return 0
  const best = (w: string, pool: string[]) => Math.max(...pool.map(p => wordSimilarity(w, p)))
  const recall    = habit.reduce((sum, w) => { const s = best(w, said);  return sum + (s >= WORD_MATCH ? s : 0) }, 0) / habit.length
  const precision = said.reduce((sum, w)  => { const s = best(w, habit); return sum + (s >= WORD_MATCH ? s : 0) }, 0) / said.length
  return recall * (0.8 + 0.2 * precision)
}

export interface HabitCandidate<H> { habit: H; score: number }

const MIN_CANDIDATE = 0.3
const AUTO_MATCH    = 0.5
const CLEAR_MARGIN  = 0.15

// Ranks habits against every phrase given (e.g. the AI's extracted habit
// name and the raw transcript), keeping each habit's best score. `match` is
// set only when the top habit is a clear winner; otherwise the caller
// should let the user pick from `candidates`.
export function matchHabit<H extends { habit_name: string }>(
  phrases: string[], habits: H[],
): { match: H | null; candidates: HabitCandidate<H>[] } {
  const candidates = habits
    .map(habit => ({ habit, score: Math.max(0, ...phrases.map(p => habitMatchScore(p, habit.habit_name))) }))
    .filter(c => c.score >= MIN_CANDIDATE)
    .sort((a, b) => b.score - a.score)
  const [top, second] = candidates
  const clear = top && top.score >= AUTO_MATCH && (!second || top.score - second.score >= CLEAR_MARGIN)
  return { match: clear ? top.habit : null, candidates: candidates.slice(0, 4) }
}
