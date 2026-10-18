'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SegmentedTab<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  href?: string  // render as a link (route-based tabs)
}

// Tab bar with a gradient highlight that slides to the active tab. Scrolls
// sideways when the tabs don't fit, keeping the active one in view.
export default function SegmentedTabs<T extends string>({ tabs, value, onChange, className }: {
  tabs:      readonly SegmentedTab<T>[]
  value:     T
  onChange?: (v: T) => void
  className?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const items = useRef(new Map<T, HTMLElement>())
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  const measure = useCallback(() => {
    const el = items.current.get(value)
    if (!el) return
    setPill({ left: el.offsetLeft, width: el.offsetWidth })
    const s = scroller.current
    if (s && (el.offsetLeft < s.scrollLeft || el.offsetLeft + el.offsetWidth > s.scrollLeft + s.clientWidth)) {
      s.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' })
    }
  }, [value])

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (scroller.current) ro.observe(scroller.current)
    return () => ro.disconnect()
  }, [measure, tabs.length])

  return (
    <div
      ref={scroller}
      className={cn(
        'mb-6 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <div className={cn('relative flex gap-1', tabs.some(t => t.icon) ? 'min-w-full' : 'min-w-max sm:min-w-0')}>
        {pill && (
          <div
            aria-hidden
            className="absolute inset-y-0 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.7)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
          />
        )}
        {tabs.map(t => {
          const active = t.value === value
          // With icons, phones stack icon over a small label so 4–5 tabs fit
          // without scrolling; wider screens put them side by side.
          const cls = cn(
            'relative flex flex-1 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors',
            t.icon
              ? 'flex-col gap-0.5 px-2 py-1.5 text-[11px] sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm'
              : 'gap-1.5 px-3 py-2 text-sm',
            active ? 'text-snow' : 'text-slate-400 hover:text-white',
          )
          const body = <>{t.icon && <t.icon className="h-4 w-4" />}{t.label}</>
          const ref = (el: HTMLElement | null) => { if (el) items.current.set(t.value, el); else items.current.delete(t.value) }
          return t.href
            ? <Link key={t.value} href={t.href} ref={ref} className={cls} aria-current={active ? 'page' : undefined}>{body}</Link>
            : <button key={t.value} type="button" ref={ref} onClick={() => onChange?.(t.value)} className={cls} aria-pressed={active}>{body}</button>
        })}
      </div>
    </div>
  )
}
