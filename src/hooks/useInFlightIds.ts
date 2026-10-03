import { useState, useRef, useCallback } from 'react'

// Per-id in-flight lock for row-level mutations (e.g. marking a habit done).
// A single shared "busy" id would drop taps on every *other* row while one
// slow request is pending; this only blocks repeat taps on the same row.
// The ref makes begin() synchronous, so a double-tap within one render
// can't slip past the guard before the state update lands.
export function useInFlightIds() {
  const ref = useRef<Set<string>>(new Set())
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set())

  const begin = useCallback((id: string): boolean => {
    if (ref.current.has(id)) return false
    ref.current.add(id)
    setIds(new Set(ref.current))
    return true
  }, [])

  const end = useCallback((id: string) => {
    ref.current.delete(id)
    setIds(new Set(ref.current))
  }, [])

  return { inFlight: ids, begin, end }
}
