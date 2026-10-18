import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Full class names per tone so Tailwind's scanner picks them up.
const TONES = {
  violet:  { card: 'border-violet-500/20 from-violet-500/15',   icon: 'bg-violet-500/15 text-violet-300' },
  sky:     { card: 'border-sky-500/20 from-sky-500/15',         icon: 'bg-sky-500/15 text-sky-300' },
  emerald: { card: 'border-emerald-500/20 from-emerald-500/15', icon: 'bg-emerald-500/15 text-emerald-300' },
  amber:   { card: 'border-amber-500/20 from-amber-500/15',     icon: 'bg-amber-500/15 text-amber-300' },
  orange:  { card: 'border-orange-500/20 from-orange-500/15',   icon: 'bg-orange-500/15 text-orange-300' },
  rose:    { card: 'border-rose-500/20 from-rose-500/15',       icon: 'bg-rose-500/15 text-rose-300' },
} as const

// A headline number with its label, in a softly tinted card.
export default function StatTile({ icon: Icon, label, value, sub, tone = 'violet', className }: {
  icon:       LucideIcon
  label:      string
  value:      React.ReactNode
  sub?:       React.ReactNode
  tone?:      keyof typeof TONES
  className?: string
}) {
  const t = TONES[tone]
  return (
    <div className={cn('card-sheen rounded-2xl border bg-gradient-to-br to-transparent p-3', t.card, className)}>
      <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', t.icon)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="mt-2 truncate text-xl font-bold leading-tight text-white">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}
