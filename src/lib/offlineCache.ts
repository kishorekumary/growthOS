const NS = 'zenith_cache_v1'

export function readCache<T>(userId: string, key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${NS}:${userId}:${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeCache<T>(userId: string, key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${NS}:${userId}:${key}`, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage disabled — best effort, ignore
  }
}
