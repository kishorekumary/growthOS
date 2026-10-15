'use client'

import { useEffect } from 'react'
import { applyDaypart } from '@/lib/daypart'

// Moves the background tint along as the day goes on. The initial value is
// set before paint by DAYPART_INIT_SCRIPT; this re-checks every few minutes
// and when the app comes back to the foreground.
export default function DaypartWatcher() {
  useEffect(() => {
    const sync = () => applyDaypart()
    const onVisible = () => { if (document.visibilityState === 'visible') sync() }
    const id = setInterval(sync, 5 * 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}
