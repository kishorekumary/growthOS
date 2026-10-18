import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from '@/components/layout/ThemeToggle'

// Full class names per tone so Tailwind's scanner picks them up.
const TONES = {
  violet:  { tile: 'from-violet-500 to-indigo-600',  glow: 'bg-violet-500/40' },
  fuchsia: { tile: 'from-violet-500 to-fuchsia-600', glow: 'bg-fuchsia-500/40' },
  emerald: { tile: 'from-emerald-400 to-teal-600',   glow: 'bg-emerald-500/40' },
  sky:     { tile: 'from-sky-400 to-blue-600',       glow: 'bg-sky-500/40' },
  amber:   { tile: 'from-amber-400 to-orange-600',   glow: 'bg-amber-500/40' },
  rose:    { tile: 'from-rose-400 to-pink-600',      glow: 'bg-rose-500/40' },
  cyan:    { tile: 'from-cyan-400 to-sky-600',       glow: 'bg-cyan-500/40' },
  indigo:  { tile: 'from-indigo-400 to-violet-700',  glow: 'bg-indigo-500/40' },
  slate:   { tile: 'from-slate-500 to-slate-700',    glow: 'bg-slate-500/30' },
} as const

export type HeaderTone = keyof typeof TONES

// The standard section header: a glowing gradient icon tile, title and
// subtitle, with optional actions on the right. On desktop it always ends
// with the light/dark toggle, so it sits in the same spot on every page
// (phones have it in the top bar instead — src/app/(main)/layout.tsx).
export default function PageHeader({ icon: Icon, title, subtitle, tone = 'violet', right, className }: {
  icon:       LucideIcon
  title:      string
  subtitle?:  React.ReactNode
  tone?:      HeaderTone
  right?:     React.ReactNode
  className?: string
}) {
  const t = TONES[tone]
  return (
    <div className={cn('mb-6 flex items-center gap-3', className)}>
      <div className="relative shrink-0">
        <div aria-hidden className={cn('absolute inset-0 rounded-2xl blur-xl', t.glow)} />
        <div className={cn('relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg', t.tile)}>
          <Icon className="h-6 w-6 text-snow" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
      <ThemeToggle className="hidden shrink-0 md:flex" />
    </div>
  )
}
