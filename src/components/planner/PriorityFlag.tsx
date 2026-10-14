import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_LABEL } from '@/lib/planner/priority'
import type { Priority } from '@/lib/planner/types'

export const PRIORITY_COLOR: Record<Priority, string> = {
  high:   'text-red-400',
  medium: 'text-amber-400',
  low:    'text-sky-400',
}

const PRIORITY_CHIP: Record<Priority, string> = {
  high:   'bg-red-500/15 text-red-300',
  medium: 'bg-amber-500/15 text-amber-300',
  low:    'bg-sky-500/15 text-sky-300',
}

// Small coloured flag + label for a task's priority; renders nothing without one.
export default function PriorityFlag({ priority, compact }: { priority: Priority | null; compact?: boolean }) {
  if (!priority) return null
  return (
    <span
      title={`${PRIORITY_LABEL[priority]} priority`}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full text-[11px] font-semibold',
        compact ? PRIORITY_COLOR[priority] : cn('px-2 py-0.5', PRIORITY_CHIP[priority]),
      )}
    >
      <Flag className="h-3 w-3" fill="currentColor" />
      {!compact && (priority === 'medium' ? 'Med' : PRIORITY_LABEL[priority])}
    </span>
  )
}
