'use client'

import { Wallet, LayoutDashboard, Receipt, Target, PieChart, Sparkles } from 'lucide-react'
import PageHeader from '@/components/ui/page-header'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { SkeletonCards } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import GoalsWidget from '@/components/goals/GoalsWidget'
import BankSyncNudge from '@/components/finance/BankSyncNudge'

const FinanceOverview  = dynamic(() => import('@/components/finance/FinanceOverview'),  { loading: () => <SectionSkeleton /> })
const FinanceBudget    = dynamic(() => import('@/components/finance/FinanceBudget'),    { loading: () => <SectionSkeleton /> })
const FinanceGoals     = dynamic(() => import('@/components/finance/FinanceGoals'),     { loading: () => <SectionSkeleton /> })
const SpendingChart    = dynamic(() => import('@/components/finance/SpendingChart'),    { loading: () => <SectionSkeleton /> })
const ExpenseTracker   = dynamic(() => import('@/components/finance/ExpenseTracker'),   { loading: () => <SectionSkeleton /> })
const AIChat           = dynamic(() => import('@/components/shared/AIChat'),            { loading: () => <SectionSkeleton /> })

function SectionSkeleton() {
  return <SkeletonCards />
}

function buildMonths() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, i)
    return {
      label: format(d, i === 0 ? "'This month'" : 'MMM yyyy'),
      start: startOfMonth(d).toISOString().split('T')[0],
      end:   endOfMonth(d).toISOString().split('T')[0],
    }
  })
}

const MONTHS = buildMonths()

const TABS = ['Overview', 'Tracker', 'Goals', 'Budget', 'Coach'] as const
type Tab = typeof TABS[number]
const TAB_ICONS = { Overview: LayoutDashboard, Tracker: Receipt, Goals: Target, Budget: PieChart, Coach: Sparkles }
const TAB_ITEMS = TABS.map(t => ({ value: t, label: t, icon: TAB_ICONS[t] }))

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [monthIdx, setMonthIdx] = useState(0)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && (TABS as readonly string[]).includes(t)) setTab(t as Tab)
  }, [])
  const selectedMonth = MONTHS[monthIdx]

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <PageHeader icon={Wallet} tone="sky" title="Finance" subtitle="Build wealth, reduce stress" />

      {/* Goals widget — hidden on the Goals tab to avoid showing two goal lists */}
      {tab !== 'Goals' && <GoalsWidget category="finance" />}

      <SegmentedTabs tabs={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === 'Overview' && <FinanceOverview />}
      {tab === 'Budget'   && <FinanceBudget />}
      {tab === 'Goals'    && <FinanceGoals />}

      {tab === 'Tracker' && (
        <div className="space-y-6">
          {/* Shared month selector */}
          <div className="flex gap-1.5 flex-wrap">
            {MONTHS.map((m, i) => (
              <button
                key={m.start}
                type="button"
                onClick={() => setMonthIdx(i)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  monthIdx === i
                    ? 'border-violet-500 bg-violet-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <SpendingChart start={selectedMonth.start} end={selectedMonth.end} />

          <div className="border-t border-white/10 pt-6">
            <div className="mb-5 empty:hidden"><BankSyncNudge /></div>
            <ExpenseTracker start={selectedMonth.start} end={selectedMonth.end} />
          </div>
        </div>
      )}

      {tab === 'Coach' && <AIChat section="finance" />}
    </div>
  )
}
