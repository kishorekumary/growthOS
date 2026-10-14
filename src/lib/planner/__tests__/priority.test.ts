import { describe, expect, it } from 'vitest'
import { byPriority, priorityRank } from '@/lib/planner/priority'
import type { Priority } from '@/lib/planner/types'

const it_ = (id: string, priority: Priority | null) => ({ id, priority })

describe('byPriority', () => {
  it('orders high, medium, low, then none', () => {
    const sorted = byPriority([it_('n', null), it_('l', 'low'), it_('h', 'high'), it_('m', 'medium')])
    expect(sorted.map(i => i.id)).toEqual(['h', 'm', 'l', 'n'])
  })
  it('keeps the original order within a level', () => {
    const sorted = byPriority([it_('a', null), it_('b', 'high'), it_('c', null), it_('d', 'high')])
    expect(sorted.map(i => i.id)).toEqual(['b', 'd', 'a', 'c'])
  })
  it('treats a missing priority (older cached rows) as none', () => {
    expect(priorityRank(undefined)).toBe(priorityRank(null))
  })
})
