'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Coins } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { POINTS_CHANGED_EVENT } from '@/lib/pointsEvents'
import CountUp from '@/components/ui/count-up'

// The points balance, always in view (phone top bar, desktop sidebar), with
// a "+N" float when it goes up. Re-reads on POINTS_CHANGED_EVENT, page
// changes and returning to the app.
export default function PointsChip({ variant }: { variant: 'bar' | 'sidebar' }) {
  const pathname = usePathname()
  const [balance, setBalance] = useState<number | null>(null)
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  const last = useRef<number | null>(null)

  const load = useCallback(async () => {
    const { data } = await createSupabaseBrowserClient()
      .from('user_rewards').select('points_balance').maybeSingle()
    const next = data?.points_balance ?? 0
    if (last.current !== null && next > last.current) setGain({ n: next - last.current, key: Date.now() })
    last.current = next
    setBalance(next)
  }, [])

  useEffect(() => { load() }, [load, pathname])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener(POINTS_CHANGED_EVENT, load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(POINTS_CHANGED_EVENT, load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])
  useEffect(() => {
    if (!gain) return
    const t = setTimeout(() => setGain(null), 1000)
    return () => clearTimeout(t)
  }, [gain])

  if (balance === null) return null
  return (
    <Link
      href="/rewards"
      aria-label={`${balance} points, open rewards`}
      className={cn(
        'relative flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 font-semibold text-amber-300 transition-[background-color,transform] hover:bg-amber-500/20 active:scale-95',
        variant === 'bar' ? 'h-8 px-2.5 text-xs' : 'mx-3 mt-2 justify-center px-3 py-1.5 text-sm',
      )}
    >
      <Coins className={variant === 'bar' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      <CountUp value={balance} />
      {variant === 'sidebar' && <span className="font-normal text-amber-300/60">points</span>}
      {gain && (
        <span
          key={gain.key}
          aria-hidden
          className="pointer-events-none absolute -top-3 right-1 animate-float-up text-[11px] font-bold text-emerald-400 motion-reduce:hidden"
        >
          +{gain.n}
        </span>
      )}
    </Link>
  )
}
