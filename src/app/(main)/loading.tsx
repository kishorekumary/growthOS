import { PageSkeleton } from '@/components/ui/skeleton'

// Shown instantly on navigation while a page in this group loads, so a tap
// never lands on a frozen screen.
export default function Loading() {
  return <PageSkeleton />
}
