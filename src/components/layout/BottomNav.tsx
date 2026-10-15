'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CheckSquare, Timer, Target, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',  icon: LayoutDashboard },
  { href: '/books',     label: 'Books', icon: BookOpen },
  { href: '/focus',     label: 'Focus', icon: Timer },
  { href: '/goals',     label: 'Goals', icon: Target },
  { href: '/planner',   label: 'Plan',  icon: CheckSquare },
]

export default function BottomNav() {
  const pathname = usePathname()
  const activeIndex = NAV_ITEMS.findIndex(({ href }) => pathname === href || pathname.startsWith(href + '/'))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-white/[0.06] bg-surface-deep/95 backdrop-blur-md md:hidden">
      {/* Pill behind the active icon; slides between tabs, fades out on
          pages that aren't in the bar. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 flex justify-center transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          activeIndex < 0 && 'opacity-0',
        )}
        style={{ width: `${100 / NAV_ITEMS.length}%`, transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
      >
        <div className="mt-[9px] h-7 w-14 rounded-full bg-indigo-500/15" />
      </div>

      {NAV_ITEMS.map(({ href, label, icon: Icon }, i) => {
        const active = i === activeIndex
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-[color,transform] duration-150 active:scale-90 motion-reduce:active:scale-100',
              active ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400',
            )}
          >
            {/* Keyed on `active` so the pop replays each time a tab is selected. */}
            <Icon
              key={String(active)}
              className={cn('h-5 w-5', active && 'animate-pop drop-shadow-[0_0_6px_rgba(99,102,241,0.8)] motion-reduce:animate-none')}
            />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
