'use client'

import { Brain, Flame, Target, BookOpen, Sparkles } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Habits',  href: '/personality/habits',  icon: Flame },
  { label: 'Goals',   href: '/personality/goals',   icon: Target },
  { label: 'Journal', href: '/personality/journal', icon: BookOpen },
  { label: 'Coach',   href: '/personality/coach',   icon: Sparkles },
]
const TAB_ITEMS = TABS.map(t => ({ value: t.href, label: t.label, icon: t.icon, href: t.href }))

export default function PersonalityTabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <PageHeader icon={Brain} tone="fuchsia" title="Personality" subtitle="Know yourself, grow yourself" />

      <SegmentedTabs tabs={TAB_ITEMS} value={pathname} />

      {children}
    </div>
  )
}
