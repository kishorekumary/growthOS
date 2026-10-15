import { describe, expect, it } from 'vitest'
import { habitMatchScore, matchHabit } from '@/lib/habitMatch'

const habits = [
  { id: '1', habit_name: 'Meditation' },
  { id: '2', habit_name: 'Book reading' },
  { id: '3', habit_name: 'Morning run' },
  { id: '4', habit_name: 'Drink 3L water' },
  { id: '5', habit_name: 'Journaling' },
  { id: '6', habit_name: 'Evening walk' },
]
const pick = (...phrases: string[]) => matchHabit(phrases, habits).match?.habit_name ?? null

describe('matchHabit', () => {
  it('matches different word forms', () => {
    expect(pick('I meditated today')).toBe('Meditation')
    expect(pick('finished reading my book')).toBe('Book reading')
    expect(pick('did my journal')).toBe('Journaling')
  })
  it('matches irregular verbs and synonyms', () => {
    expect(pick('ran this morning')).toBe('Morning run')
    expect(pick('went for a jog in the morning')).toBe('Morning run')
    expect(pick('drank water')).toBe('Drink 3L water')
  })
  it('tolerates small mishearings', () => {
    expect(pick('meditaton done')).toBe('Meditation')
    expect(pick('evening wak')).toBe('Evening walk')
  })
  it('uses the best of several phrases', () => {
    expect(pick('reading', 'habit book reading done')).toBe('Book reading')
  })
  it('does not auto-match when unrelated or ambiguous', () => {
    expect(pick('paid the electricity bill')).toBeNull()
    const both = matchHabit(['morning'], [{ habit_name: 'Morning run' }, { habit_name: 'Morning pages' }])
    expect(both.match).toBeNull()
    expect(both.candidates.map(c => c.habit.habit_name)).toEqual(['Morning run', 'Morning pages'])
  })
  it('scores an exact name at 1', () => {
    expect(habitMatchScore('Book reading', 'Book reading')).toBe(1)
  })
})
