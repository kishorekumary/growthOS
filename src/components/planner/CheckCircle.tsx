'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// 28px circle inside a 44px tap target — the one-tap check-off used by every
// planner row.
export default function CheckCircle({ checked, disabled, label, onClick }: {
  checked:   boolean
  disabled?: boolean
  label:     string
  onClick:   () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="-m-2 shrink-0 p-2 disabled:cursor-default"
    >
      <span className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-200',
        checked
          ? 'animate-pop border-emerald-500 bg-emerald-500'
          : 'border-slate-500 hover:border-emerald-400',
      )}>
        {checked && <Check className="h-4 w-4 text-emerald-950" strokeWidth={3} />}
      </span>
    </button>
  )
}
