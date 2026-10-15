import { Skeleton, SkeletonCards } from '@/components/ui/skeleton'

// Dashboard-shaped placeholder: date + greeting, a hero card, then sections.
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-7 w-56" />
      </div>
      <Skeleton className="mb-6 h-28 w-full rounded-2xl" />
      <SkeletonCards count={4} />
    </div>
  )
}
