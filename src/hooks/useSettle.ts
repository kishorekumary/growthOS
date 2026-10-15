import { useCallback, useEffect, useRef, useState } from 'react'

const add = (id: string) => (prev: Set<string>) => prev.has(id) ? prev : new Set(prev).add(id)
const del = (id: string) => (prev: Set<string>) => {
  if (!prev.has(id)) return prev
  const n = new Set(prev); n.delete(id); return n
}

// Keeps a just-checked row in its list for a moment, then collapses it out.
//   hold(id)    — keep the row where it is (call synchronously on tap)
//   release(id) — after `holdMs`, start collapsing (`leaving`); after a
//                 further `collapseMs`, drop it from `held` so it moves on
//   cancel(id)  — the action failed: forget the row immediately
// Render held rows as still open, wrapped in <Collapse open={!leaving.has(id)}>.
export function useSettle(holdMs = 700, collapseMs = 280) {
  const [held, setHeld] = useState<Set<string>>(new Set())
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const t = timers.current
    return () => { t.forEach(clearTimeout); t.clear() }
  }, [])

  const clear = (id: string) => {
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }
  }

  const hold = useCallback((id: string) => {
    clear(id)
    setHeld(add(id))
    setLeaving(del(id))
  }, [])

  const cancel = useCallback((id: string) => {
    clear(id)
    setHeld(del(id))
    setLeaving(del(id))
  }, [])

  const release = useCallback((id: string) => {
    clear(id)
    timers.current.set(id, setTimeout(() => {
      setLeaving(add(id))
      timers.current.set(id, setTimeout(() => {
        timers.current.delete(id)
        setHeld(del(id))
        setLeaving(del(id))
      }, collapseMs))
    }, holdMs))
  }, [holdMs, collapseMs])

  return { held, leaving, hold, release, cancel }
}
