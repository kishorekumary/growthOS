'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'

const OPTIONS: { pref: ThemePref; label: string; icon: LucideIcon }[] = [
  { pref: 'system', label: 'System', icon: Monitor },
  { pref: 'light',  label: 'Light',  icon: Sun },
  { pref: 'dark',   label: 'Dark',   icon: Moon },
]

// Stored per device. "System" follows the phone / computer's own theme.
export default function AppearanceSettings() {
  const [pref, setPref] = useState<ThemePref>('system')
  useEffect(() => { setPref(getThemePref()) }, [])

  function choose(next: ThemePref) {
    setPref(next)
    setThemePref(next)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
        {OPTIONS.map(({ pref: p, label, icon: Icon }) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={pref === p}
            onClick={() => choose(p)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors',
              pref === p
                ? 'border-violet-500/50 bg-violet-500/10'
                : 'border-white/8 bg-white/3 hover:border-white/15',
            )}
          >
            <Icon className={cn('h-4 w-4', pref === p ? 'text-violet-400' : 'text-slate-500')} />
            <span className="text-sm font-semibold text-white">{label}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-600">
        Applies to this device. System matches your phone or computer&apos;s light / dark setting.
      </p>
    </div>
  )
}
