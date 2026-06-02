'use client'

import { Search } from 'lucide-react'

export default function MobileSearchButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('global-search-open'))}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
      aria-label="Search"
    >
      <Search className="h-4 w-4" />
    </button>
  )
}
