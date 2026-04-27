'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const BookDiscover  = dynamic(() => import('@/components/books/BookDiscover'),  { loading: () => <Spinner /> })
const ReadingList   = dynamic(() => import('@/components/books/ReadingList'),   { loading: () => <Spinner /> })
const BookChallenge = dynamic(() => import('@/components/books/BookChallenge'), { loading: () => <Spinner /> })
const AIChat        = dynamic(() => import('@/components/shared/AIChat'),        { loading: () => <Spinner /> })

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )
}

const TABS = ['Discover', 'My List', 'Challenge', 'Coach'] as const
type Tab = typeof TABS[number]

export default function BooksPage() {
  const [tab, setTab] = useState<Tab>('Discover')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Books</h1>
        <p className="text-slate-400 text-sm mt-1">Read intentionally, grow constantly</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 mb-6">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg py-2 text-center text-sm font-medium transition-all',
              tab === t
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Discover'   && <BookDiscover />}
      {tab === 'My List'    && <ReadingList />}
      {tab === 'Challenge'  && <BookChallenge />}
      {tab === 'Coach'      && <AIChat section="books" />}
    </div>
  )
}
