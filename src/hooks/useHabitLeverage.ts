import { useMemo } from 'react'
import { useCachedQuery } from '@/hooks/useCachedQuery'

export interface Leverage { habit_id: string; pain: string | null; pleasure: string | null }

// The user's pain/pleasure reasons for each habit (migration 050). `available`
// is false until the migration is applied — the query errors, and callers
// hide leverage UI instead of showing an editor that can't save.
export function useHabitLeverage() {
  const { data, isOffline, loading, setData } = useCachedQuery<Leverage[]>(
    'habit-leverage',
    (supabase, userId) => supabase
      .from('habit_leverage').select('habit_id, pain, pleasure').eq('user_id', userId),
    [],
  )
  const byHabit = useMemo(() => new Map(data.map(l => [l.habit_id, l])), [data])
  return { byHabit, available: !isOffline, loading, setData }
}

// One line to show at the moment of choice. Alternates pain and pleasure
// by day when both exist, so the reminder doesn't go stale.
export function leverageLine(l: Leverage | undefined, dateStr: string): string | null {
  const pain = l?.pain?.trim(), pleasure = l?.pleasure?.trim()
  if (!pain && !pleasure) return null
  if (pain && pleasure) return Number(dateStr.slice(-1)) % 2 === 0 ? `Skipping costs me: ${pain}` : `Doing it gives me: ${pleasure}`
  return pain ? `Skipping costs me: ${pain}` : `Doing it gives me: ${pleasure}`
}
