'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Overview', href: '/personality' },
  { label: 'Habits',   href: '/personality/habits' },
  { label: 'Journal',  href: '/personality/journal' },
  { label: 'Coach',    href: '/personality/coach' },
]

export default function PersonalityTabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Personality</h1>
        <p className="text-slate-400 text-sm mt-1">Know yourself, grow yourself</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 mb-6">
        {TABS.map(({ label, href }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 rounded-lg py-2 text-center text-sm font-medium transition-all',
                active
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
