'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Brain, Dumbbell, Wallet, BookOpen, Target, CheckSquare, Timer, Settings, LogOut } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/personality',  label: 'Personality', icon: Brain },
  { href: '/fitness',      label: 'Fitness',     icon: Dumbbell },
  { href: '/finance',      label: 'Finance',     icon: Wallet },
  { href: '/books',        label: 'Books',       icon: BookOpen },
  { href: '/goals',        label: 'Goals',       icon: Target },
  { href: '/todos',        label: 'Tasks',       icon: CheckSquare },
  { href: '/focus',        label: 'Focus',       icon: Timer },
]

interface SidebarProps {
  userName: string
  userEmail: string
  avatarUrl: string | null
}

export default function Sidebar({ userName, userEmail, avatarUrl }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-white/10 bg-slate-950">
      {/* Logo */}
      <Link href="/dashboard" className="flex h-16 items-center gap-2.5 border-b border-white/10 px-6 hover:opacity-80 transition-opacity">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20 border border-purple-500/30">
          <span className="text-sm">🌱</span>
        </div>
        <span className="text-lg font-bold text-white tracking-tight">
          Growth<span className="text-purple-400">OS</span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-purple-600/20 text-purple-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom: Settings → User → Logout */}
      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/settings' || pathname.startsWith('/settings/')
              ? 'bg-purple-600/20 text-purple-300'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>

        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600/30 text-xs font-semibold text-purple-300">
              {initials || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-slate-500 truncate">{userEmail}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  )
}
