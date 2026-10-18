'use client'

import PageHeader from '@/components/ui/page-header'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Timer, Brain, SearchCheck, ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonCards } from '@/components/ui/skeleton'

const FocusTimer = dynamic(() => import('@/components/focus/FocusTimer'), {
  loading: () => <SkeletonCards />,
})

// Full class names per tone so Tailwind's scanner picks them up.
const TOOL_TONES = {
  violet: { card: 'border-violet-500/25 from-violet-500/15', glow: 'bg-violet-500/30', tile: 'border-violet-500/30 bg-violet-500/15 text-violet-300', link: 'text-violet-300' },
  amber:  { card: 'border-amber-500/25 from-amber-500/15',   glow: 'bg-amber-500/30',  tile: 'border-amber-500/30 bg-amber-500/15 text-amber-300',   link: 'text-amber-300' },
} as const

const TOOLS: { href: string; icon: LucideIcon; tone: keyof typeof TOOL_TONES; title: string; detail: string; meta: string }[] = [
  {
    href: '/focus/mindshift', icon: Brain, tone: 'violet',
    title: 'Mindshift Leakage Score',
    detail: 'Find where your mental energy leaks.',
    meta: '20 questions · 5 dimensions',
  },
  {
    href: '/focus/overthinking-audit', icon: SearchCheck, tone: 'amber',
    title: 'The Overthinking Audit',
    detail: 'Diagnose your thinking patterns.',
    meta: '10 questions · 3 buckets',
  },
]

export default function FocusPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <PageHeader icon={Timer} tone="violet" title="Focus" subtitle="Protect your attention, one interval at a time" />

      <FocusTimer />

      <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">Know your mind</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map(({ href, icon: Icon, tone, title, detail, meta }) => {
          const t = TOOL_TONES[tone]
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'card-sheen group relative overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent p-5 transition-transform hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none',
                t.card,
              )}
            >
              <div aria-hidden className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl', t.glow)} />
              <div className={cn('relative flex h-10 w-10 items-center justify-center rounded-xl border', t.tile)}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="relative mt-3 text-sm font-semibold text-white">{title}</p>
              <p className="relative mt-0.5 text-xs text-slate-400">{detail}</p>
              <p className="relative mt-3 flex items-center justify-between text-[11px] text-slate-500">
                {meta}
                <span className={cn('flex items-center gap-1 font-medium', t.link)}>
                  Start <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
