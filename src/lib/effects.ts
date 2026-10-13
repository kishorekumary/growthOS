import { Capacitor } from '@capacitor/core'

// Celebration preferences, per device. "calm" turns off particles, sound and
// vibration (a gentle pulse remains); the OS "reduce motion" setting turns
// off moving visuals but leaves sound/vibration alone.

export type EffectsMode = 'full' | 'calm'

const KEY = 'growthos:effects'
export const EFFECTS_CHANGE_EVENT = 'growthos:effects-change'

export function getEffectsMode(): EffectsMode {
  try {
    return localStorage.getItem(KEY) === 'calm' ? 'calm' : 'full'
  } catch {
    return 'full'
  }
}

export function setEffectsMode(mode: EffectsMode) {
  try { localStorage.setItem(KEY, mode) } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EFFECTS_CHANGE_EVENT))
}

function osReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Particles, bursts and confetti.
export function motionAllowed(): boolean {
  return getEffectsMode() === 'full' && !osReducedMotion()
}

// Chimes and vibration.
export function feedbackAllowed(): boolean {
  return getEffectsMode() === 'full'
}

// Light tap on every check-off, a stronger pattern for bigger moments. In the
// Android app this goes through Capacitor's native haptics (the WebView
// ignores navigator.vibrate); in browsers that support it, the Vibration API.
export function haptic(kind: 'tick' | 'success') {
  if (!feedbackAllowed()) return
  try {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/haptics').then(({ Haptics, ImpactStyle, NotificationType }) => {
        if (kind === 'tick') Haptics.impact({ style: ImpactStyle.Light })
        else Haptics.notification({ type: NotificationType.Success })
      }).catch(() => { /* plugin missing in an older app build */ })
      return
    }
    navigator.vibrate?.(kind === 'tick' ? 15 : [30, 60, 30, 60, 60])
  } catch {
    // Vibration unavailable — visuals still play.
  }
}
