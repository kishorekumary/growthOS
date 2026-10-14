// Light / dark appearance, per device (like the Celebrations setting).
// 'system' follows the OS theme. The resolved theme is a class on <html>
// ('light' or 'dark'); tailwind.config.ts swaps the palette under `.light`.

export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'growthos:theme'
export const THEME_CHANGE_EVENT = 'growthos:theme-change'

// Browser chrome / Android status bar colour per theme (matches --app-bg).
export const THEME_COLOR: Record<Theme, string> = { dark: '#07071a', light: '#f5f6fb' }

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function resolveTheme(pref: ThemePref): Theme {
  return pref === 'system' ? systemTheme() : pref
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
  root.style.colorScheme = theme
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', THEME_COLOR[theme]))
}

export function setThemePref(pref: ThemePref) {
  try { localStorage.setItem(THEME_KEY, pref) } catch { /* storage unavailable */ }
  applyTheme(resolveTheme(pref))
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

// Inlined into <head> so the right theme is on <html> before first paint
// (no flash of the dark theme for light users). Keep in sync with the
// functions above — it can't import them.
export const THEME_INIT_SCRIPT = `(function(){try{
var p=localStorage.getItem('${THEME_KEY}');
var t=p==='light'||p==='dark'?p:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
var r=document.documentElement;r.classList.add(t);r.style.colorScheme=t;
}catch(e){document.documentElement.classList.add('dark');}})();`
