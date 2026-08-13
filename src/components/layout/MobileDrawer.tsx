'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen,
  Target, CheckSquare, Timer, Newspaper, CalendarCheck,
  Flame, NotebookPen, Images, Settings, LogOut, ShieldCheck, X, Gift,
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
  { href: '/rewards',             label: 'Rewards',    icon: Gift },
  { href: '/focus',               label: 'Focus',      icon: Timer },
  { href: '/digest',              label: 'Digest',     icon: Newspaper },
  { href: '/retro',               label: 'Retro',      icon: CalendarCheck },
  { href: '/challenges',          label: 'Challenges', icon: Flame },
  { href: '/personality/journal', label: 'Journal',    icon: NotebookPen },
  { href: '/gallery',             label: 'Gallery',    icon: Images },
]

interface MobileDrawerProps {
  userName: string
  userEmail: string
  avatarUrl: string | null
  isAdmin: boolean
}

export default function MobileDrawer({ userName, userEmail, avatarUrl, isAdmin }: MobileDrawerProps) {
  const [open, setOpen]     = useState(false)
  const pathname            = usePathname()
  const router              = useRouter()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    function onEvent() { setOpen(true) }
    window.addEventListener('mobile-drawer-open', onEvent)
    return () => window.removeEventListener('mobile-drawer-open', onEvent)
  }, [])

  // Close on route change
  useEffect(() => { close() }, [pathname, close])

  async function handleLogout() {
    close()
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={close}
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[61] flex w-72 flex-col bg-[#06060f] border-r border-white/[0.06] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-white/[0.06] shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={close}>
            <ZenithIcon className="h-8 w-8 shrink-0" />
            <div className="leading-tight">
              <span className="block text-[16px] font-bold tracking-tight text-white">Zenith</span>
              <span className="block text-[9px] tracking-[0.18em] uppercase text-indigo-400/60 font-medium">Peak Performance</span>
            </div>
          </Link>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-indigo-500/[0.15] text-white'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
                )}
              >
                <Icon className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  active ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400',
                )} />
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/[0.06] p-3 space-y-0.5 shrink-0">
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                pathname.startsWith('/admin')
                  ? 'bg-violet-500/[0.15] text-white'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
              )}
            >
              <ShieldCheck className={cn(
                'h-[18px] w-[18px] shrink-0',
                pathname.startsWith('/admin') ? 'text-violet-400' : 'text-slate-600 group-hover:text-violet-400',
              )} />
              Admin
            </Link>
          )}

          <Link
            href="/settings"
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              pathname === '/settings'
                ? 'bg-indigo-500/[0.15] text-white'
                : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
            )}
          >
            <Settings className={cn(
              'h-[18px] w-[18px] shrink-0',
              pathname === '/settings' ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400',
            )} />
            Settings
          </Link>

          {/* User row */}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10 shrink-0" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 ring-1 ring-indigo-500/30 text-[11px] font-semibold text-indigo-300 shrink-0">
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
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-white/[0.05] hover:text-slate-300 transition-all"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}
