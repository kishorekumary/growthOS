'use client'

import { useEffect } from 'react'
import { applyTheme, getThemePref, resolveTheme, THEME_CHANGE_EVENT } from '@/lib/theme'

// Keeps <html>'s theme class in step with the OS while the preference is
// 'system', and syncs the browser chrome colour. The initial class is set
// by THEME_INIT_SCRIPT before paint; this only handles changes after that.
export default function ThemeWatcher() {
  useEffect(() => {
    const sync = () => applyTheme(resolveTheme(getThemePref()))
    sync()
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onSystemChange = () => { if (getThemePref() === 'system') sync() }
    mq.addEventListener?.('change', onSystemChange)
    window.addEventListener(THEME_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)  // changed in another tab
    return () => {
      mq.removeEventListener?.('change', onSystemChange)
      window.removeEventListener(THEME_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return null
}
