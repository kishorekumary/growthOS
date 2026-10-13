'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/effects'
import { useHabitCelebration } from '@/hooks/useHabitCelebration'
import ListClearedBurst from '@/components/shared/ListClearedBurst'
import { periodLabel, periodStart } from '@/lib/planner/periods'
import { isDoneIn } from '@/lib/planner/visibility'
import type { ItemPatch } from '@/lib/planner/actions'
import type { PeriodType, PlannerCompletion, PlannerItem } from '@/lib/planner/types'
import type { PlannerHabit } from '@/hooks/usePlannerHabits'
import PlannerItemRow from './PlannerItemRow'
import HabitRow from './HabitRow'
import QuickAdd from './QuickAdd'
import ProgressRing from './ProgressRing'

export interface PeriodListProps {
  type:        PeriodType
  start:       string
  today:       string
  variant:     'column' | 'tab'
  items:       PlannerItem[]
  completions: PlannerCompletion[]
  habits:      PlannerHabit[]
  habitBusy:   ReadonlySet<string>
  itemBusy:    ReadonlySet<string>
  highlightId?: string | null
  onNavigate?: (delta: number) => void
  onAdd:       (title: string, repeats: boolean) => void
  onToggle:    (item: PlannerItem) => Promise<number>
  onUpdate:    (item: PlannerItem, patch: ItemPatch) => void
  onMove:      (item: PlannerItem, type: PeriodType, start: string) => void
  onDelete:    (item: PlannerItem) => void
  onHabitDone: (habit: PlannerHabit) => void
  onDropItem?: (itemId: string) => void
}

const ADD_PLACEHOLDER: Record<PeriodType, string> = {
  day: 'Add to this day…', week: 'Add to this week…', month: 'Add to this month…',
}

export function countDone({ items, completions, habits, start }: Pick<PeriodListProps, 'items' | 'completions' | 'habits' | 'start'>) {
  const done = items.filter(i => isDoneIn(i, start, completions)).length + habits.filter(h => h.done).length
  return { done, total: items.length + habits.length }
}

export default function PeriodList(props: PeriodListProps) {
  const {
    type, start, today, variant, items, completions, habits, habitBusy, itemBusy, highlightId,
    onNavigate, onAdd, onToggle, onUpdate, onMove, onDelete, onHabitDone, onDropItem,
  } = props
  const [showDone, setShowDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // Items just checked off stay in the open list for 700ms so the pop,
  // strike-through and "+N" flash are visible before they move to Done.
  const [recentlyDone, setRecentlyDone] = useState<Set<string>>(new Set())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const t = timers.current
    return () => { t.forEach(clearTimeout); t.clear() }
  }, [])

  const unmark = (id: string) => setRecentlyDone(prev => {
    if (!prev.has(id)) return prev
    const n = new Set(prev); n.delete(id); return n
  })

  // Celebrations: coin burst + light haptic per check-off; confetti + success
  // haptic when that check-off empties the list.
  const { celebrate, celebrationNode } = useHabitCelebration()
  const [cleared, setCleared] = useState(false)
  const clearedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (clearedTimer.current) clearTimeout(clearedTimer.current) }, [])

  const openCount = () =>
    items.filter(i => !isDoneIn(i, start, completions)).length + habits.filter(h => !h.done).length

  function celebrateCheck(emptiedList: boolean) {
    if (!emptiedList) { celebrate(); return }
    haptic('success')
    setCleared(true)
    if (clearedTimer.current) clearTimeout(clearedTimer.current)
    clearedTimer.current = setTimeout(() => setCleared(false), 2000)
  }

  function habitDone(habit: PlannerHabit) {
    if (habit.done) return
    const emptiesList = openCount() === 1
    onHabitDone(habit)
    celebrateCheck(emptiesList)
  }

  async function toggle(item: PlannerItem) {
    // usePlanner updates optimistically before its network await, so mark the
    // row synchronously (before onToggle) to keep it mounted from the tap.
    const wasOpen = !isDoneIn(item, start, completions)
    const emptiesList = wasOpen && openCount() === 1
    const prior = timers.current.get(item.id)
    if (prior) { clearTimeout(prior); timers.current.delete(item.id) }
    if (wasOpen) setRecentlyDone(prev => new Set(prev).add(item.id))
    let delta = 0
    try {
      delta = await onToggle(item)
    } catch (err) {
      unmark(item.id)
      throw err
    }
    if (wasOpen && delta > 0) {
      const timer = setTimeout(() => { timers.current.delete(item.id); unmark(item.id) }, 700)
      timers.current.set(item.id, timer)
      celebrateCheck(emptiesList)
    } else {
      unmark(item.id)
    }
    return delta
  }

  const { done, total } = countDone(props)
  const pct = total ? Math.round((done / total) * 100) : 0
  const isDone     = (i: PlannerItem) => isDoneIn(i, start, completions)
  const openItems  = items.filter(i => !isDone(i) || recentlyDone.has(i.id))
  const doneItems  = items.filter(i => isDone(i) && !recentlyDone.has(i.id))
  const openHabits = habits.filter(h => !h.done)
  const doneHabits = habits.filter(h => h.done)
  const doneCount  = doneItems.length + doneHabits.length
  const futureStart = start > periodStart(type, today)

  const renderItem = (item: PlannerItem) => (
    <PlannerItemRow
      key={item.id}
      item={item}
      done={isDoneIn(item, start, completions)}
      busy={itemBusy.has(`${item.id}:${start}`)}
      disabled={item.repeats && futureStart}
      today={today}
      draggable={variant === 'column'}
      highlight={highlightId === item.id}
      onToggle={() => toggle(item)}
      onUpdate={patch => onUpdate(item, patch)}
      onMove={(t, s) => onMove(item, t, s)}
      onDelete={() => onDelete(item)}
    />
  )

  return (
    <section
      onDragOver={onDropItem ? e => { e.preventDefault(); setDragOver(true) } : undefined}
      onDragLeave={onDropItem ? () => setDragOver(false) : undefined}
      onDrop={onDropItem ? e => {
        e.preventDefault()
        setDragOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDropItem(id)
      } : undefined}
      className={cn(
        'space-y-3 rounded-2xl transition-colors',
        variant === 'column' && 'border border-white/8 bg-white/[0.02] p-4',
        dragOver && 'border-violet-500/50 bg-violet-500/[0.05]',
      )}
    >
      {celebrationNode}
      {cleared && typeof document !== 'undefined' &&
        createPortal(<ListClearedBurst label={periodLabel(type, start, today)} />, document.body)}

      {/* Header */}
      <div className="flex items-center gap-3">
        {variant === 'tab' && <ProgressRing done={done} total={total} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {onNavigate && (
              <button type="button" onClick={() => onNavigate(-1)} className="rounded-md p-1 text-slate-500 hover:text-white" aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="truncate text-base font-bold text-white">{periodLabel(type, start, today)}</h2>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate(1)} className="rounded-md p-1 text-slate-500 hover:text-white" aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <span className="ml-auto text-xs tabular-nums text-slate-500">{done} / {total}</span>
          </div>
          {variant === 'column' && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>

      <QuickAdd placeholder={ADD_PLACEHOLDER[type]} onAdd={onAdd} />

      {/* Open */}
      <div className="space-y-2">
        {openHabits.map(h => (
          <HabitRow key={h.id} habit={h} busy={habitBusy.has(h.id)} onDone={() => habitDone(h)} />
        ))}
        {openItems.map(renderItem)}
        {openHabits.length + openItems.length === 0 && (
          <p className="py-3 text-center text-xs text-slate-600">
            {total > 0 ? 'All clear 🎉' : 'Nothing planned yet.'}
          </p>
        )}
      </div>

      {/* Done */}
      {doneCount > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowDone(s => !s)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300"
          >
            {showDone ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Done ({doneCount})
          </button>
          {showDone && (
            <>
              {doneHabits.map(h => (
                <HabitRow key={h.id} habit={h} busy={habitBusy.has(h.id)} onDone={() => habitDone(h)} />
              ))}
              {doneItems.map(renderItem)}
            </>
          )}
        </div>
      )}
    </section>
  )
}
