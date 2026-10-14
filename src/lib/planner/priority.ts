import type { Priority } from './types'

export const PRIORITIES: Priority[] = ['high', 'medium', 'low']

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

// High first, then medium, low, and no priority last.
export function priorityRank(p: Priority | null | undefined): number {
  return p === 'high' ? 0 : p === 'medium' ? 1 : p === 'low' ? 2 : 3
}

// Stable sort by priority — within a level, items keep the order they came in.
export function byPriority<T extends { priority?: Priority | null }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => priorityRank(a.item.priority) - priorityRank(b.item.priority) || a.i - b.i)
    .map(x => x.item)
}
