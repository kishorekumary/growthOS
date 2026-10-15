import { cn } from '@/lib/utils'

// Placeholder shapes shown while a page or section loads. The shimmer is
// defined in globals.css (.skeleton) and stops under "reduce motion".

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton rounded-lg', className)} {...props} />
}

// A stack of card-shaped placeholders — the stand-in for a lazily loaded
// section (replaces the old centred spinner).
export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn('space-y-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Whole-page placeholder: title block, then cards. Matches the common
// `mx-auto max-w-2xl px-4 py-8 md:px-8` page shell.
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <SkeletonCards count={cards} />
    </div>
  )
}
