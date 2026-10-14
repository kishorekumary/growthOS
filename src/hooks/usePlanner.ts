'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { todayStr } from '@/lib/habitStreak'
import { useToday } from '@/hooks/useToday'
import { useInFlightIds } from '@/hooks/useInFlightIds'
import { periodStart } from '@/lib/planner/periods'
import { isDoneIn } from '@/lib/planner/visibility'
import {
  completeItem, deleteItem, fetchPlanner, insertItem, patchItem, uncompleteItem,
  type ItemPatch, type NewItem,
} from '@/lib/planner/actions'
import type { PeriodType, PlannerCompletion, PlannerItem } from '@/lib/planner/types'

// All planner state for one screen. Every mutation is optimistic and rolls
// back the touched row on failure.
export function usePlanner(from: string) {
  const [items, setItems]             = useState<PlannerItem[]>([])
  const [completions, setCompletions] = useState<PlannerCompletion[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const reqIdRef = useRef(0)
  const { inFlight: busy, begin, end } = useInFlightIds()
  const today = useToday()

  const load = useCallback(async () => {
    const req = ++reqIdRef.current
    const db = createSupabaseBrowserClient()
    const { data: { session } } = await db.auth.getSession()
    if (req !== reqIdRef.current) return
    const userId = session?.user?.id
    if (!userId) { setLoading(false); return }
    userIdRef.current = userId
    try {
      const res = await fetchPlanner(db, userId, from)
      if (req !== reqIdRef.current) return
      setItems(res.items)
      setCompletions(res.completions)
      setError(null)
    } catch {
      if (req !== reqIdRef.current) return
      setError('Could not load your planner. Check your connection and try again.')
    }
    if (req !== reqIdRef.current) return
    setLoading(false)
  }, [from])

  useEffect(() => { load() }, [load])

  const replaceItem = (id: string, next: PlannerItem) =>
    setItems(prev => prev.map(i => (i.id === id ? next : i)))

  async function add(fields: NewItem) {
    const userId = userIdRef.current
    if (!userId || !fields.title.trim()) return
    const tempId = `temp-${Date.now()}`
    const temp: PlannerItem = {
      id: tempId, user_id: userId, title: fields.title.trim(), notes: fields.notes ?? null,
      period_type: fields.period_type, period_start: periodStart(fields.period_type, fields.period_start),
      repeats: fields.repeats ?? false, is_completed: false, completed_at: null, points_awarded: 0,
      carry_count: 0, ended_at: null, sort_order: 0, priority: fields.priority ?? null, created_at: new Date().toISOString(),
    }
    setItems(prev => [...prev, temp])
    try {
      const saved = await insertItem(createSupabaseBrowserClient(), userId, fields)
      replaceItem(tempId, saved)
    } catch {
      setItems(prev => prev.filter(i => i.id !== tempId))
      setError('Could not add that item.')
    }
  }

  // Returns the points delta (positive on check, negative on uncheck, 0 if
  // nothing happened) so the row can flash "+N".
  async function toggle(item: PlannerItem, start: string): Promise<number> {
    const userId = userIdRef.current
    const key = `${item.id}:${start}`
    if (!userId || item.id.startsWith('temp-') || !begin(key)) return 0
    const db = createSupabaseBrowserClient()
    const wasDone = isDoneIn(item, start, completions)
    const tempCompletionId = `temp-${key}`
    try {
      if (!wasDone) {
        if (item.repeats) {
          setCompletions(prev => [...prev, {
            id: tempCompletionId, item_id: item.id, period_start: start,
            completed_at: new Date().toISOString(), points_awarded: 0,
          }])
        } else {
          replaceItem(item.id, { ...item, is_completed: true, completed_at: new Date().toISOString() })
        }
        const { completion, points } = await completeItem(db, userId, item, start, todayStr())
        if (item.repeats && completion) {
          setCompletions(prev => prev.map(c => (c.id === tempCompletionId ? completion : c)))
        }
        if (!item.repeats && points) {
          replaceItem(item.id, { ...item, is_completed: true, completed_at: new Date().toISOString(), points_awarded: points })
        }
        return points
      }
      if (item.repeats) {
        setCompletions(prev => prev.filter(c => !(c.item_id === item.id && c.period_start === start)))
      } else {
        replaceItem(item.id, { ...item, is_completed: false, completed_at: null, points_awarded: 0 })
      }
      return -(await uncompleteItem(db, userId, item, start))
    } catch {
      // Roll back just this row.
      replaceItem(item.id, item)
      if (item.repeats) {
        const prior = completions.filter(c => c.item_id === item.id && c.period_start === start)
        setCompletions(prev => [
          ...prev.filter(c => !(c.item_id === item.id && c.period_start === start)),
          ...prior,
        ])
      }
      setError('Could not save that change.')
      return 0
    } finally {
      end(key)
    }
  }

  async function update(item: PlannerItem, patch: ItemPatch) {
    replaceItem(item.id, { ...item, ...patch })
    try {
      await patchItem(createSupabaseBrowserClient(), item.id, patch)
    } catch {
      replaceItem(item.id, item)
      setError('Could not save that change.')
    }
  }

  const move = (item: PlannerItem, type: PeriodType, start: string) =>
    update(item, { period_type: type, period_start: periodStart(type, start) })

  const carryToNow = (item: PlannerItem) =>
    update(item, { period_start: periodStart(item.period_type, today), carry_count: item.carry_count + 1 })

  const drop = (item: PlannerItem) => update(item, { ended_at: new Date().toISOString() })

  async function remove(item: PlannerItem) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    try {
      await deleteItem(createSupabaseBrowserClient(), item.id)
    } catch {
      setItems(prev => [...prev, item])
      setError('Could not delete that item.')
    }
  }

  return {
    items, completions, loading, error, clearError: () => setError(null), today, busy,
    add, toggle, update, move, carryToNow, drop, remove,
  }
}
