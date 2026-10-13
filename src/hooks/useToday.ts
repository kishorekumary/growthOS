import { useEffect, useState } from 'react'
import { todayStr } from '@/lib/habitStreak'

// The device-local date (YYYY-MM-DD) that re-renders the caller when it
// changes: a timer fires just after local midnight, and returning to the tab
// re-checks (timers are throttled or frozen in background tabs and sleeping
// phones, so the timer alone can't be trusted).
export function useToday(): string {
  const [today, setToday] = useState(todayStr)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const sync = () => setToday(todayStr())
    const schedule = () => {
      const next = new Date()
      next.setHours(24, 0, 1, 0) // 00:00:01 tomorrow, local time
      timer = setTimeout(() => { sync(); schedule() }, next.getTime() - Date.now())
    }
    const onVisible = () => { if (document.visibilityState === 'visible') sync() }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', sync)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', sync)
    }
  }, [])

  return today
}
