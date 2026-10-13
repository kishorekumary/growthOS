'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { getEffectsMode, setEffectsMode, type EffectsMode } from '@/lib/effects'

const OPTIONS: { mode: EffectsMode; label: string; detail: string }[] = [
  { mode: 'full', label: 'Full',  detail: 'Coin bursts, confetti, sound and vibration' },
  { mode: 'calm', label: 'Calm',  detail: 'A gentle pulse only. No particles, sound or vibration' },
]

// Stored per device (a phone and a laptop can differ). The phone's own
// "reduce motion" setting is always respected on top of this.
export default function EffectsSettings() {
  const [mode, setMode] = useState<EffectsMode>('full')
  useEffect(() => { setMode(getEffectsMode()) }, [])

  function choose(next: EffectsMode) {
    setMode(next)
    setEffectsMode(next)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Celebration effects">
        {OPTIONS.map(o => (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={mode === o.mode}
            onClick={() => choose(o.mode)}
            className={cn(
              'rounded-xl border p-3 text-left transition-colors',
              mode === o.mode
                ? 'border-violet-500/50 bg-violet-500/10'
                : 'border-white/8 bg-white/3 hover:border-white/15',
            )}
          >
            <p className="text-sm font-semibold text-white">{o.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{o.detail}</p>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-600">
        Applies to this device. Your phone&apos;s &ldquo;Reduce motion&rdquo; setting also turns off moving effects.
      </p>
    </div>
  )
}
