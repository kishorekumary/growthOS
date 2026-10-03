import { useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import type { CheckIn, Decision } from '@/lib/decisionLog'

// Decision log data (migration 050). `available` is false until it's applied.
export function useDecisions() {
  const { data, loading, isOffline, setData } = useCachedQuery<Decision[]>(
    'decisions',
    (supabase, userId) => supabase
      .from('decisions')
      .select('id, statement, first_action, decided_on, action_taken, review_7, review_30, created_at')
      .eq('user_id', userId)
      .order('decided_on', { ascending: false })
      .order('created_at', { ascending: false }),
    [],
  )

  const answer = useCallback(async (d: Decision, checkIn: CheckIn, yes: boolean) => {
    const patch = checkIn === 'action'
      ? { action_taken: yes }
      : { [checkIn]: yes ? 'kept' : 'slipped' } as Partial<Decision>
    setData(prev => prev.map(x => x.id === d.id ? { ...x, ...patch } : x))
    const { error } = await createSupabaseBrowserClient()
      .from('decisions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', d.id)
    if (error) setData(prev => prev.map(x => x.id === d.id ? d : x))   // roll back
  }, [setData])

  return { decisions: data, loading, available: !isOffline, setDecisions: setData, answer }
}
