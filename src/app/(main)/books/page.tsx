'use client'

import { BookOpen, Library, Trophy, Sparkles, Compass } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { SkeletonCards } from '@/components/ui/skeleton'
import GoalsWidget from '@/components/goals/GoalsWidget'

const BookDiscover  = dynamic(() => import('@/components/books/BookDiscover'),  { loading: () => <SectionSkeleton /> })
const ReadingList   = dynamic(() => import('@/components/books/ReadingList'),   { loading: () => <SectionSkeleton /> })
const BookChallenge = dynamic(() => import('@/components/books/BookChallenge'), { loading: () => <SectionSkeleton /> })
const AIChat        = dynamic(() => import('@/components/shared/AIChat'),        { loading: () => <SectionSkeleton /> })

function SectionSkeleton() {
  return <SkeletonCards />
}

const TABS = ['My List', 'Challenge', 'Coach', 'Discover'] as const
type Tab = typeof TABS[number]
const TAB_ICONS = { 'My List': Library, Challenge: Trophy, Coach: Sparkles, Discover: Compass }
const TAB_ITEMS = TABS.map(t => ({ value: t, label: t, icon: TAB_ICONS[t] }))

export default function BooksPage() {
  const [tab, setTab] = useState<Tab>('My List')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && (TABS as readonly string[]).includes(t)) setTab(t as Tab)
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <PageHeader icon={BookOpen} tone="amber" title="Books" subtitle="Read intentionally, grow constantly" />

      {/* Goals widget */}
      <GoalsWidget category="books" />

      <SegmentedTabs tabs={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === 'Discover'   && <BookDiscover />}
      {tab === 'My List'    && <ReadingList />}
      {tab === 'Challenge'  && <BookChallenge />}
      {tab === 'Coach'      && <AIChat section="books" />}
    </div>
  )
}
