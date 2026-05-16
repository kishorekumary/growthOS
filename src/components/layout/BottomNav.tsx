'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CheckSquare, Dumbbell, Target, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',   icon: LayoutDashboard },
  { href: '/fitness',   label: 'Fitness',icon: Dumbbell },
  { href: '/goals',     label: 'Goals',  icon: Target },
  { href: '/focus',     label: 'Focus',  icon: Timer },
  { href: '/todos',     label: 'Tasks',  icon: CheckSquare },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-white/[0.06] bg-[#06060f]/95 backdrop-blur-md md:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
              active ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400',
            )}
          >
            <Icon className={cn('h-5 w-5', active && 'drop-shadow-[0_0_6px_rgba(99,102,241,0.8)]')} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
