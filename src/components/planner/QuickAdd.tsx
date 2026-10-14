'use client'

import { useState } from 'react'
import { Flag, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_LABEL } from '@/lib/planner/priority'
import type { Priority } from '@/lib/planner/types'
import { PRIORITY_COLOR } from './PriorityFlag'

// Each tap on the flag moves to the next priority, wrapping back to none.
const NEXT_PRIORITY: Record<Priority | 'none', Priority | null> = {
  none: 'high', high: 'medium', medium: 'low', low: null,
}

export default function QuickAdd({ placeholder, onAdd }: {
  placeholder: string
  onAdd: (title: string, repeats: boolean, priority: Priority | null) => void
}) {
  const [title, setTitle]       = useState('')
  const [repeats, setRepeats]   = useState(false)
  const [priority, setPriority] = useState<Priority | null>(null)

  function submit() {
    if (!title.trim()) return
    onAdd(title.trim(), repeats, priority)
    setTitle('')
    setRepeats(false)
    setPriority(null)
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2.5 focus-within:border-violet-500/40">
      <Plus className="h-4 w-4 shrink-0 text-slate-500" />
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setPriority(p => NEXT_PRIORITY[p ?? 'none'])}
        aria-label={priority ? `${PRIORITY_LABEL[priority]} priority (tap to change)` : 'Set priority'}
        title={priority ? `${PRIORITY_LABEL[priority]} priority` : 'Set priority'}
        className={cn(
          'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors',
          priority ? cn('bg-white/5', PRIORITY_COLOR[priority]) : 'text-slate-500 hover:text-slate-300',
        )}
      >
        <Flag className="h-3.5 w-3.5" fill={priority ? 'currentColor' : 'none'} />
        {priority && (priority === 'medium' ? 'Med' : PRIORITY_LABEL[priority])}
      </button>
      <button
        type="button"
        onClick={() => setRepeats(r => !r)}
        aria-pressed={repeats}
        aria-label={repeats ? 'Repeats every period' : 'Make this repeat'}
        title={repeats ? 'Repeats every period' : 'Make this repeat'}
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-semibold transition-colors',
          repeats ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-500 hover:text-slate-300',
        )}
      >
        ↻
      </button>
    </div>
  )
}
