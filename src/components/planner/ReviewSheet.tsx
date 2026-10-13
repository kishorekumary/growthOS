'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { moveTargets, periodLabel } from '@/lib/planner/periods'
import { PERIOD_TYPES, type PeriodType, type PlannerItem } from '@/lib/planner/types'

const GROUP_LABEL: Record<PeriodType, string> = { day: 'Earlier days', week: 'Earlier weeks', month: 'Earlier months' }
const BTN = 'rounded-md px-2 py-1 text-xs font-medium transition-colors'

export default function ReviewSheet({
  open, onOpenChange, items, today, onMoveToNow, onReschedule, onDone, onDrop, onLater,
}: {
  open:         boolean
  onOpenChange: (open: boolean) => void
  items:        PlannerItem[]
  today:        string
  onMoveToNow:  (item: PlannerItem) => void
  onReschedule: (item: PlannerItem, type: PeriodType, start: string) => void
  onDone:       (item: PlannerItem) => void
  onDrop:       (item: PlannerItem) => void
  onLater:      () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto max-md:bottom-0 max-md:top-auto max-md:max-w-none max-md:translate-y-0 max-md:rounded-b-none">
        <DialogHeader>
          <DialogTitle className="text-white">Leftovers to review</DialogTitle>
          <DialogDescription className="text-slate-400">
            These weren&apos;t finished before their day, week or month ended. Decide what happens to each.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {PERIOD_TYPES.map(type => {
            const group = items.filter(i => i.period_type === type)
            if (!group.length) return null
            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{GROUP_LABEL[type]}</h3>
                  <button type="button" onClick={() => group.forEach(onMoveToNow)} className={`${BTN} ml-auto text-violet-300 hover:bg-violet-500/15`}>
                    Move all to now
                  </button>
                  <button type="button" onClick={() => group.forEach(onDrop)} className={`${BTN} text-slate-500 hover:bg-white/10 hover:text-white`}>
                    Drop all
                  </button>
                </div>
                {group.map(item => (
                  <div key={item.id} className="space-y-2 rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-white">{item.title}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">{periodLabel(type, item.period_start, today)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => onMoveToNow(item)} className={`${BTN} bg-violet-600 text-white hover:bg-violet-500`}>
                        Move to now
                      </button>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger className={`${BTN} bg-white/5 text-slate-300 hover:bg-white/10`}>
                          Reschedule…
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content sideOffset={4} className="z-[60] min-w-[150px] rounded-lg border border-white/10 bg-slate-900 p-1 shadow-xl">
                            {moveTargets(today).map(t => (
                              <DropdownMenu.Item
                                key={t.label}
                                onSelect={() => onReschedule(item, t.type, t.start)}
                                className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-slate-200 outline-none data-[highlighted]:bg-white/10"
                              >
                                {t.label}
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                      <button type="button" onClick={() => onDone(item)} className={`${BTN} bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25`}>
                        Done
                      </button>
                      <button type="button" onClick={() => onDrop(item)} className={`${BTN} text-slate-500 hover:bg-white/10 hover:text-white`}>
                        Drop
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onLater} className={`${BTN} text-slate-400 hover:text-white`}>
            Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
