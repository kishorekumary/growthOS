import type { SupabaseClient } from '@supabase/supabase-js'
import { currentPeriods, periodStart, windowStart } from './periods'
import { pointsFor } from './points'
import { reminderTitles, type ReminderItem } from './reminders'
import type { PeriodType, PlannerCompletion, PlannerItem } from './types'

// Works with the browser, server and admin Supabase clients alike.
export type Db = SupabaseClient

export const ITEM_COLUMNS =
  'id, user_id, title, notes, period_type, period_start, repeats, is_completed, completed_at, points_awarded, carry_count, ended_at, sort_order, created_at'
export const COMPLETION_COLUMNS = 'id, item_id, period_start, completed_at, points_awarded'

// Everything a planner screen anchored at `from` needs: items placed from
// `from` on, anything completed since `from` (rewards), every open one-off
// (leftovers can be arbitrarily old) and every repeating item (they apply
// forward from their start).
export async function fetchPlanner(db: Db, userId: string, from: string) {
  const [items, completions] = await Promise.all([
    db.from('planner_items')
      .select(ITEM_COLUMNS)
      .eq('user_id', userId)
      .is('ended_at', null)
      .or(`repeats.eq.true,is_completed.eq.false,period_start.gte.${from},completed_at.gte.${from}`)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    db.from('planner_completions')
      .select(COMPLETION_COLUMNS)
      .eq('user_id', userId)
      .gte('period_start', from),
  ])
  if (items.error) throw items.error
  if (completions.error) throw completions.error
  return {
    items:       (items.data ?? []) as PlannerItem[],
    completions: (completions.data ?? []) as PlannerCompletion[],
  }
}

export interface NewItem {
  title:        string
  notes?:       string | null
  period_type:  PeriodType
  period_start: string   // any date inside the target period; aligned here
  repeats?:     boolean
}

export async function insertItem(db: Db, userId: string, fields: NewItem): Promise<PlannerItem> {
  const { data, error } = await db.from('planner_items')
    .insert({
      user_id:      userId,
      title:        fields.title.trim(),
      notes:        fields.notes?.trim() || null,
      period_type:  fields.period_type,
      period_start: periodStart(fields.period_type, fields.period_start),
      repeats:      fields.repeats ?? false,
    })
    .select(ITEM_COLUMNS)
    .single()
  if (error) throw error
  return data as PlannerItem
}

export type ItemPatch = Partial<Pick<PlannerItem,
  'title' | 'notes' | 'period_type' | 'period_start' | 'repeats' | 'carry_count' | 'ended_at' | 'sort_order'>>

export async function patchItem(db: Db, id: string, patch: ItemPatch): Promise<void> {
  const { error } = await db.from('planner_items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteItem(db: Db, id: string): Promise<void> {
  const { error } = await db.from('planner_items').delete().eq('id', id)
  if (error) throw error
}

// Same three-step write the old Tasks feature used. A failure here must
// never undo the check-off itself, so errors are logged, not thrown.
export async function adjustPoints(db: Db, userId: string, delta: number, reason: string): Promise<void> {
  if (!delta) return
  const { error: upsertErr } = await db.from('user_rewards')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (upsertErr) console.error('Failed to adjust planner points:', upsertErr)
  const { error: logErr } = await db.from('reward_points_log').insert({ user_id: userId, delta, reason })
  if (logErr) console.error('Failed to adjust planner points:', logErr)
  const { error: rpcErr } = await db.rpc('increment_points_balance', { p_user_id: userId, p_delta: delta })
  if (rpcErr) console.error('Failed to adjust planner points:', rpcErr)
}

// Marks `item` done for period `start` and awards points. Both write paths
// are guarded so a duplicate tap/request awards nothing the second time.
export async function completeItem(
  db: Db, userId: string, item: PlannerItem, start: string, today: string,
): Promise<{ completion: PlannerCompletion | null; points: number }> {
  const points = pointsFor(item, today)

  if (item.repeats) {
    const { data, error } = await db.from('planner_completions')
      .insert({ item_id: item.id, user_id: userId, period_start: start, points_awarded: points })
      .select(COMPLETION_COLUMNS)
      .single()
    if (error) {
      if ((error as { code?: string }).code === '23505') return { completion: null, points: 0 } // already done
      throw error
    }
    await adjustPoints(db, userId, points, `Planner: ${item.title}`)
    return { completion: data as PlannerCompletion, points }
  }

  const now = new Date().toISOString()
  const { data, error } = await db.from('planner_items')
    .update({ is_completed: true, completed_at: now, points_awarded: points, updated_at: now })
    .eq('id', item.id)
    .eq('is_completed', false)
    .select('id')
  if (error) throw error
  if (!data?.length) return { completion: null, points: 0 } // already done
  await adjustPoints(db, userId, points, `Planner: ${item.title}`)
  return { completion: null, points }
}

// Reverses completeItem using the amount actually stored at completion time.
export async function uncompleteItem(db: Db, userId: string, item: PlannerItem, start: string): Promise<number> {
  let points = 0

  if (item.repeats) {
    const { data, error } = await db.from('planner_completions')
      .delete()
      .eq('item_id', item.id)
      .eq('period_start', start)
      .select('points_awarded')
    if (error) throw error
    points = (data ?? []).reduce((s, c) => s + (c.points_awarded as number), 0)
  } else {
    const { data, error } = await db.from('planner_items')
      .update({ is_completed: false, completed_at: null, points_awarded: 0, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('is_completed', true)
      .select('id')
    if (error) throw error
    points = data?.length ? item.points_awarded : 0
  }

  await adjustPoints(db, userId, -points, `Undo: ${item.title}`)
  return points
}

// Open one-offs in (or left over from before) the current day/week/month —
// what QuickReset and the opening briefing list. Returns the query builder so
// callers can hand it to useCachedQuery.
export function openNowQuery(db: Db, userId: string, today: string) {
  const now = currentPeriods(today)
  return db.from('planner_items')
    .select(ITEM_COLUMNS)
    .eq('user_id', userId)
    .is('ended_at', null)
    .eq('repeats', false)
    .eq('is_completed', false)
    .or([
      `and(period_type.eq.day,period_start.lte.${now.day})`,
      `and(period_type.eq.week,period_start.lte.${now.week})`,
      `and(period_type.eq.month,period_start.lte.${now.month})`,
    ].join(','))
    .order('period_start', { ascending: true })
    .returns<PlannerItem[]>()
}

export async function fetchReminderTitles(db: Db, userId: string, day: string): Promise<string[]> {
  const [items, done] = await Promise.all([
    db.from('planner_items')
      .select('id, title, period_type, period_start, repeats, is_completed, ended_at')
      .eq('user_id', userId)
      .is('ended_at', null)
      .or('repeats.eq.true,is_completed.eq.false')
      .lte('period_start', day),
    db.from('planner_completions')
      .select('item_id, period_start')
      .eq('user_id', userId)
      .gte('period_start', windowStart(day)),
  ])
  return reminderTitles((items.data ?? []) as ReminderItem[], done.data ?? [], day).slice(0, 10)
}
