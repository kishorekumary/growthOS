'use client'

import ZenithIcon from './ZenithIcon'

export default function MobileMenuButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('mobile-drawer-open'))}
      className="flex items-center gap-2.5 hover:opacity-80 active:opacity-60 transition-opacity"
      aria-label="Open menu"
    >
      <ZenithIcon className="h-7 w-7" />
      <span className="text-base font-bold text-white tracking-tight">Zenith</span>
    </button>
  )
}
