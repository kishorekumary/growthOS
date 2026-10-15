import { cn } from '@/lib/utils'

// The 🔥 next to a live streak, flickering gently. `seed` (e.g. the streak
// count) offsets the cycle so a column of flames doesn't pulse in lockstep.
export default function StreakFlame({ seed = 0, className }: { seed?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block origin-bottom animate-flicker motion-reduce:animate-none', className)}
      style={{ animationDelay: `${-((seed * 0.37) % 1.8)}s` }}
    >
      🔥
    </span>
  )
}
