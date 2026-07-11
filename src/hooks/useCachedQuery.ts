import { useState, useEffect, useCallback, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/offlineCache'

type SupabaseClient = ReturnType<typeof createSupabaseBrowserClient>
type QueryResult<T> = PromiseLike<{ data: T | null; error: unknown }>

export interface UseCachedQueryResult<T> {
  data:      T
  loading:   boolean
  isOffline: boolean
  refetch:   () => void
  setData:   (updater: T | ((prev: T) => T)) => void
}

// Fetches via Supabase, but hydrates instantly from the last-good cached result
// and never overwrites shown data with empty on a failed/offline fetch. Re-fetches
// automatically when the browser comes back online.
export function useCachedQuery<T>(
  cacheKey: string,
  queryFn: (supabase: SupabaseClient, userId: string) => QueryResult<T>,
  defaultValue: T,
  deps: unknown[] = []
): UseCachedQueryResult<T> {
  const [data, setDataState]   = useState<T>(defaultValue)
  const [loading, setLoading]  = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const userIdRef = useRef<string | null>(null)
  const hydratedRef = useRef(false)

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) { setLoading(false); return }
    userIdRef.current = userId

    if (!hydratedRef.current) {
      hydratedRef.current = true
      const cached = readCache<T>(userId, cacheKey)
      if (cached !== null) {
        setDataState(cached)
        setLoading(false)
      }
    }

    const { data: result, error } = await queryFn(supabase, userId)
    if (error) {
      setIsOffline(true)
      setLoading(false)
      return
    }
    setIsOffline(false)
    setLoading(false)
    const value = result ?? defaultValue
    setDataState(value)
    writeCache(userId, cacheKey, value)
    // defaultValue intentionally excluded from deps — it's expected to be a stable literal per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...deps])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    window.addEventListener('online', load)
    return () => window.removeEventListener('online', load)
  }, [load])

  const setData = useCallback((updater: T | ((prev: T) => T)) => {
    setDataState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater
      if (userIdRef.current) writeCache(userIdRef.current, cacheKey, next)
      return next
    })
  }, [cacheKey])

  return { data, loading, isOffline, refetch: load, setData }
}
