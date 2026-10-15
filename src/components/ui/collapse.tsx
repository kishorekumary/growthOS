import { cn } from '@/lib/utils'

// A list-row wrapper that slides in when it mounts and, when `open` turns
// false, shrinks its height (and the list gap above it) to zero so the rows
// below glide up. Content is clipped only while closing, so open rows can
// still show things that overflow (e.g. the "+N" points flash).
export default function Collapse({ open = true, as: Tag = 'div', children }: {
  open?:    boolean
  as?:      'div' | 'li'
  children: React.ReactNode
}) {
  return (
    <Tag
      className={cn(
        'grid animate-in fade-in-0 slide-in-from-top-1 duration-300',
        'transition-[grid-template-rows,opacity,margin] ease-out motion-reduce:animate-none motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : '!mt-0 grid-rows-[0fr] opacity-0',
      )}
    >
      <div className={cn('min-h-0', !open && 'overflow-hidden')}>{children}</div>
    </Tag>
  )
}
