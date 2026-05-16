'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Settings, LogOut,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import ZenithIcon from './ZenithIcon'

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/personality/habits',  label: 'Habits',     icon: Brain },
  { href: '/fitness',             label: 'Fitness',    icon: Dumbbell },
  { href: '/finance',             label: 'Finance',    icon: Wallet },
  { href: '/books',               label: 'Books',      icon: BookOpen },
  { href: '/goals',               label: 'Goals',      icon: Target },
  { href: '/todos',               label: 'Tasks',      icon: CheckSquare },
  { href: '/focus',               label: 'Focus',      icon: Timer },
  { href: '/digest',              label: 'Digest',     icon: Newspaper },
  { href: '/retro',               label: 'Retro',      icon: CalendarCheck },
  { href: '/challenges',          label: 'Challenges', icon: Flame },
  { href: '/personality/journal', label: 'Journal',    icon: NotebookPen },
]

interface SidebarProps {
  userName: string
  userEmail: string
  avatarUrl: string | null
}

export default function Sidebar({ userName, userEmail, avatarUrl }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 flex-col bg-[#06060f] border-r border-white/[0.06]">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex h-[64px] items-center gap-3 px-5 border-b border-white/[0.06] hover:opacity-90 transition-opacity shrink-0"
      >
        <ZenithIcon className="h-9 w-9 shrink-0" />
        <div className="leading-tight">
          <span className="block text-[17px] font-bold tracking-tight text-white">Zenith</span>
          <span className="block text-[10px] tracking-[0.18em] uppercase text-indigo-400/60 font-medium">Peak Performance</span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-indigo-500/[0.15] text-white'
                  : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-200',
              )}
            >
              <Icon className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                active ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400',
              )} />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/[0.06] p-3 space-y-0.5 shrink-0">
        <Link
          href="/settings"
          className={cn(
            'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
            pathname === '/settings' || pathname.startsWith('/settings/')
              ? 'bg-indigo-500/[0.15] text-white'
              : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-200',
          )}
        >
          <Settings className={cn(
            'h-4 w-4 shrink-0',
            pathname.startsWith('/settings') ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400',
          )} />
          Settings
        </Link>

        {/* User */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-7 w-7 rounded-full object-cover ring-1 ring-white/10" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 ring-1 ring-indigo-500/30 text-[11px] font-semibold text-indigo-300">
              {initials || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-slate-600 truncate">{userEmail}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white/[0.05] hover:text-slate-300 transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  )
}
