'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToday } from '@/hooks/useToday'
import { usePlanner } from '@/hooks/usePlanner'
import { usePlannerHabits } from '@/hooks/usePlannerHabits'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { currentPeriods, rollPeriods, shiftPeriod, windowStart } from '@/lib/planner/periods'
import { isVisibleIn, leftovers } from '@/lib/planner/visibility'
import { PERIOD_TYPES, type PeriodType, type Priority } from '@/lib/planner/types'
import PeriodList, { countDone } from './PeriodList'
import ReviewSheet from './ReviewSheet'
import PlannerRewards, { type DoneEntry } from './PlannerRewards'

const TAB_LABEL: Record<PeriodType, string> = { day: 'Today', week: 'Week', month: 'Month' }
const REVIEW_DISMISSED_KEY = 'planner:review-dismissed'

function reviewDismissed(): boolean {
  try { return sessionStorage.getItem(REVIEW_DISMISSED_KEY) === '1' } catch { return false }
}
function dismissReview() {
  try { sessionStorage.setItem(REVIEW_DISMISSED_KEY, '1') } catch { /* storage unavailable */ }
}

export default function PlannerView() {
  const params    = useSearchParams()
  const isDesktop = useIsDesktop()
  const habits    = usePlannerHabits()

  const today = useToday()
  const [starts, setStarts] = useState(() => currentPeriods(today))
  const [tab, setTab]       = useState<PeriodType>('day')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // Past midnight (or back on a tab left open overnight): lists showing the
  // old current period follow to the new one.
  const prevToday = useRef(today)
  useEffect(() => {
    if (prevToday.current === today) return
    const prev = prevToday.current
    prevToday.current = today
    setStarts(s => rollPeriods(s, prev, today))
  }, [today])

  // Load from the earliest period on screen (or the current window).
  const from = [starts.day, starts.week, starts.month, windowStart(today)].sort()[0]
  const planner = usePlanner(from)
  const now = currentPeriods(today)

  const leftoverItems = useMemo(() => leftovers(planner.items, today), [planner.items, today])

  // Open the review once per session when leftovers exist (always when ?review=1).
  const reviewChecked = useRef(false)
  useEffect(() => {
    if (planner.loading || reviewChecked.current) return
    reviewChecked.current = true
    if (leftoverItems.length && (params.get('review') === '1' || !reviewDismissed())) setReviewOpen(true)
  }, [planner.loading, leftoverItems.length, params])

  useEffect(() => {
    if (reviewOpen && !leftoverItems.length) setReviewOpen(false)
  }, [reviewOpen, leftoverItems.length])

  // ?highlight=<id> from search: jump to the item's period and flash it.
  const highlightChecked = useRef(false)
  useEffect(() => {
    if (planner.loading || highlightChecked.current) return
    highlightChecked.current = true
    const id = params.get('highlight')
    const item = id ? planner.items.find(i => i.id === id) : undefined
    if (!item) return
    if (!item.repeats) setStarts(s => ({ ...s, [item.period_type]: item.period_start }))
    setTab(item.period_type)
    setHighlightId(item.id)
    setTimeout(() => {
      document.getElementById(`planner-item-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlightId(null), 2500)
    }, 150)
  }, [planner.loading, planner.items, params])

  const rewardEntries: DoneEntry[] = useMemo(() => [
    ...planner.items
      .filter(i => i.is_completed && i.completed_at)
      .map(i => ({ completed_at: i.completed_at!, points: i.points_awarded })),
    ...planner.completions.map(c => ({ completed_at: c.completed_at, points: c.points_awarded })),
  ], [planner.items, planner.completions])

  function listProps(type: PeriodType, variant: 'column' | 'tab') {
    const start = starts[type]
    const isCurrent = start === now[type]
    const listHabits = !isCurrent ? [] : type === 'day' ? habits.daily : type === 'week' ? habits.weekly : []
    return {
      type, start, today, variant,
      items:       planner.items.filter(i => isVisibleIn(i, type, start)),
      completions: planner.completions,
      habits:      listHabits,
      habitBusy:   habits.busy,
      itemBusy:    planner.busy,
      highlightId,
      onNavigate:  (delta: number) => setStarts(s => ({ ...s, [type]: shiftPeriod(type, s[type], delta) })),
      onAdd:       (title: string, repeats: boolean, priority: Priority | null) =>
        planner.add({ title, period_type: type, period_start: start, repeats, priority }),
      onToggle:    (item: Parameters<typeof planner.toggle>[0]) => planner.toggle(item, start),
      onUpdate:    planner.update,
      onMove:      planner.move,
      onDelete:    planner.remove,
      onHabitDone: habits.markDone,
      onDropItem:  variant === 'column'
        ? (id: string) => {
            const item = planner.items.find(i => i.id === id)
            if (item && !(item.period_type === type && item.period_start === start)) planner.move(item, type, start)
          }
        : undefined,
    }
  }

  return (
    <div className="space-y-4">
      {planner.error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <span className="flex-1">{planner.error}</span>
          <button type="button" onClick={planner.clearError} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      {leftoverItems.length > 0 && !reviewOpen && (
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-left text-sm font-medium text-amber-200 hover:bg-amber-500/15"
        >
          {leftoverItems.length} leftover{leftoverItems.length === 1 ? '' : 's'} to review →
        </button>
      )}

      <PlannerRewards done={rewardEntries} />

      {isDesktop ? (
        <div className="grid grid-cols-3 gap-4">
          {PERIOD_TYPES.map(type => <PeriodList key={type} {...listProps(type, 'column')} />)}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-xl bg-white/5 p-1" role="tablist">
            {PERIOD_TYPES.map(type => {
              const { done, total } = countDone(listProps(type, 'tab'))
              return (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={tab === type}
                  onClick={() => setTab(type)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-all',
                    tab === type ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {TAB_LABEL[type]} <span className="text-xs font-normal opacity-80">{done}/{total}</span>
                </button>
              )
            })}
          </div>
          <PeriodList key={tab} {...listProps(tab, 'tab')} />
        </div>
      )}

      <ReviewSheet
        open={reviewOpen}
        onOpenChange={open => { setReviewOpen(open); if (!open) dismissReview() }}
        items={leftoverItems}
        today={today}
        onMoveToNow={planner.carryToNow}
        onReschedule={planner.move}
        onDone={item => planner.toggle(item, item.period_start)}
        onDrop={planner.drop}
        onLater={() => { dismissReview(); setReviewOpen(false) }}
      />
    </div>
  )
}
