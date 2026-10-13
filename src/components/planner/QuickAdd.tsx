'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function QuickAdd({ placeholder, onAdd }: {
  placeholder: string
  onAdd: (title: string, repeats: boolean) => void
}) {
  const [title, setTitle]     = useState('')
  const [repeats, setRepeats] = useState(false)

  function submit() {
    if (!title.trim()) return
    onAdd(title.trim(), repeats)
    setTitle('')
    setRepeats(false)
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
