import { useMemo } from 'react'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { todayStr } from '@/lib/habitStreak'
import { WORKBOOK_TAG, exerciseTag, workbookStatus, type WorkbookSession } from '@/lib/workbook'

// Workbook sessions (tagged journal entries) and what's due today.
export function useWorkbook() {
  const today = todayStr()
  const { data: sessions, loading, setData } = useCachedQuery<WorkbookSession[]>(
    'workbook:sessions',
    (supabase, userId) => supabase
      .from('journal_entries').select('entry_date, tags')
      .eq('user_id', userId).contains('tags', [WORKBOOK_TAG]),
    [],
  )
  const status = useMemo(() => workbookStatus(sessions, today), [sessions, today])

  function markDone(slug: string) {
    setData(prev => [...prev, { entry_date: today, tags: [WORKBOOK_TAG, exerciseTag(slug)] }])
  }

  return { sessions, loading, status, today, markDone }
}
