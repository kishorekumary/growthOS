'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { currentTheme, setThemePref, type Theme } from '@/lib/theme'

// One-tap light/dark switch for the top-right corner. Picking here sets an
// explicit Light or Dark preference; Settings > Appearance still offers
// System. Shows the icon of the mode a tap switches to.
export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    // Follow every change to the theme class (this button, Settings, the OS).
    const sync = () => setTheme(currentTheme())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const next: Theme = theme === 'light' ? 'dark' : 'light'
  const label = `Switch to ${next} mode`

  return (
    <button
      type="button"
      onClick={() => setThemePref(next)}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors',
        className,
      )}
    >
      {/* Rendered after mount so the server markup doesn't guess the theme. */}
      {theme && (next === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
    </button>
  )
}
