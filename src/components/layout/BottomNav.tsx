'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CheckSquare, Dumbbell, Wallet, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Home',    icon: LayoutDashboard },
  { href: '/fitness',     label: 'Fitness', icon: Dumbbell },
  { href: '/goals',       label: 'Goals',   icon: Target },
  { href: '/finance',     label: 'Finance', icon: Wallet },
  { href: '/todos',       label: 'Tasks',   icon: CheckSquare },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-white/10 bg-slate-950/95 backdrop-blur-sm md:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors',
              active ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Icon className={cn('h-5 w-5', active && 'drop-shadow-[0_0_6px_rgb(167,139,250)]')} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
