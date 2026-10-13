'use client'

import { useEffect, useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowRight, MoreHorizontal, Pencil, Repeat, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { moveTargets } from '@/lib/planner/periods'
import type { ItemPatch } from '@/lib/planner/actions'
import type { PeriodType, PlannerItem } from '@/lib/planner/types'
import CheckCircle from './CheckCircle'

const REPEAT_LABEL: Record<PeriodType, string> = { day: 'daily', week: 'weekly', month: 'monthly' }
const MENU_ITEM = 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200 outline-none data-[highlighted]:bg-white/10'

export default function PlannerItemRow({
  item, done, busy, disabled, today, draggable, highlight, onToggle, onUpdate, onMove, onDelete,
}: {
  item:       PlannerItem
  done:       boolean
  busy:       boolean
  disabled?:  boolean
  today:      string
  draggable?: boolean
  highlight?: boolean
  onToggle:   () => Promise<number>
  onUpdate:   (patch: ItemPatch) => void
  onMove:     (type: PeriodType, start: string) => void
  onDelete:   () => void
}) {
  const [editing, setEditing]     = useState(false)
  const [title, setTitle]         = useState(item.title)
  const [notes, setNotes]         = useState(item.notes ?? '')
  const [showNotes, setShowNotes] = useState(false)
  const [flash, setFlash]         = useState<number | null>(null)
  const flashTimer                = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])

  async function handleToggle() {
    let delta: number
    try {
      delta = await onToggle()
    } catch {
      return
    }
    if (delta > 0) {
      setFlash(delta)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => {
        flashTimer.current = null
        setFlash(null)
      }, 900)
    }
  }

  function save() {
    if (!title.trim()) return
    onUpdate({ title: title.trim(), notes: notes.trim() || null })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl border border-violet-500/30 bg-slate-900/60 p-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus
          className="w-full bg-transparent text-sm text-white focus:outline-none"
        />
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)…"
          rows={2}
          className="w-full resize-none bg-transparent text-xs text-slate-400 placeholder:text-slate-700 focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-slate-500 hover:text-white">Cancel</button>
          <button type="button" onClick={save} className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500">Save</button>
        </div>
      </div>
    )
  }

  return (
    <div
      id={`planner-item-${item.id}`}
      draggable={draggable}
      onDragStart={e => e.dataTransfer.setData('text/plain', item.id)}
      className={cn(
        'relative rounded-xl px-3 py-3 transition-all duration-300',
        done ? 'bg-emerald-500/[0.06]' : 'bg-white/[0.04]',
        highlight && 'ring-2 ring-violet-500',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-center gap-3">
        <CheckCircle checked={done} disabled={busy || disabled} label={`${done ? 'Uncheck' : 'Check'} ${item.title}`} onClick={handleToggle} />
        <button
          type="button"
          onClick={() => item.notes && setShowNotes(s => !s)}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-sm transition-colors',
            done ? 'text-slate-500 line-through' : 'text-white',
          )}
        >
          {item.title}
        </button>
        {item.carry_count > 0 && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300" title="Times carried over">
            ↪ {item.carry_count}×
          </span>
        )}
        {item.repeats && (
          <span className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-200">
            ↻ {REPEAT_LABEL[item.period_type]}
          </span>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="-m-3.5 shrink-0 rounded-md p-3.5 text-slate-500 hover:text-white" aria-label="Item options">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-[170px] rounded-lg border border-white/10 bg-slate-900 p-1 shadow-xl">
              <DropdownMenu.Item
                className={MENU_ITEM}
                onSelect={() => {
                  setTitle(item.title)
                  setNotes(item.notes ?? '')
                  setEditing(true)
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </DropdownMenu.Item>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className={MENU_ITEM}>
                  <ArrowRight className="h-3.5 w-3.5" /> Move to…
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent sideOffset={4} className="z-50 min-w-[150px] rounded-lg border border-white/10 bg-slate-900 p-1 shadow-xl">
                    {moveTargets(today).map(t => (
                      <DropdownMenu.Item key={t.label} className={MENU_ITEM} onSelect={() => onMove(t.type, t.start)}>
                        {t.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              {item.repeats ? (
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => onUpdate({ ended_at: new Date().toISOString() })}>
                  <Repeat className="h-3.5 w-3.5" /> Stop repeating
                </DropdownMenu.Item>
              ) : !done && (
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => onUpdate({ repeats: true })}>
                  <Repeat className="h-3.5 w-3.5" /> Repeat {REPEAT_LABEL[item.period_type]}
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item className={cn(MENU_ITEM, 'text-red-300')} onSelect={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {showNotes && item.notes && (
        <p className="mt-2 whitespace-pre-wrap pl-10 text-xs text-slate-400">{item.notes}</p>
      )}
      {flash !== null && (
        <span className="pointer-events-none absolute right-10 top-1 animate-float-up text-xs font-bold text-emerald-300">
          +{flash}
        </span>
      )}
    </div>
  )
}
