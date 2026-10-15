import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Full class names per tone so Tailwind's scanner picks them up.
const TONES = {
  violet:  { glow: 'bg-violet-500/30',  tile: 'border-violet-500/25 bg-violet-500/10',   icon: 'text-violet-400' },
  orange:  { glow: 'bg-orange-500/30',  tile: 'border-orange-500/25 bg-orange-500/10',   icon: 'text-orange-400' },
  emerald: { glow: 'bg-emerald-500/30', tile: 'border-emerald-500/25 bg-emerald-500/10', icon: 'text-emerald-400' },
  amber:   { glow: 'bg-amber-500/30',   tile: 'border-amber-500/25 bg-amber-500/10',     icon: 'text-amber-400' },
  sky:     { glow: 'bg-sky-500/30',     tile: 'border-sky-500/25 bg-sky-500/10',         icon: 'text-sky-400' },
} as const

// "Nothing here yet" panel: a softly glowing, gently floating icon tile, a
// title and an encouraging hint. `children` can add an action.
export default function EmptyState({ icon: Icon, title, hint, tone = 'violet', className, children }: {
  icon:       LucideIcon
  title:      string
  hint?:      React.ReactNode
  tone?:      keyof typeof TONES
  className?: string
  children?:  React.ReactNode
}) {
  const t = TONES[tone]
  return (
    <div className={cn(
      'rounded-2xl border border-dashed border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent px-6 py-10 text-center',
      className,
    )}>
      <div className="relative mx-auto mb-4 h-14 w-14">
        <div aria-hidden className={cn('absolute inset-1 rounded-2xl opacity-70 blur-xl', t.glow)} />
        <div className={cn(
          'relative flex h-14 w-14 items-center justify-center rounded-2xl border animate-float motion-reduce:animate-none',
          t.tile,
        )}>
          <Icon className={cn('h-6 w-6', t.icon)} />
        </div>
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
