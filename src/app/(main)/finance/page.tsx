'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import GoalsWidget from '@/components/goals/GoalsWidget'

const FinanceOverview  = dynamic(() => import('@/components/finance/FinanceOverview'),  { loading: () => <Spinner /> })
const FinanceBudget    = dynamic(() => import('@/components/finance/FinanceBudget'),    { loading: () => <Spinner /> })
const FinanceGoals     = dynamic(() => import('@/components/finance/FinanceGoals'),     { loading: () => <Spinner /> })
const SpendingChart    = dynamic(() => import('@/components/finance/SpendingChart'),    { loading: () => <Spinner /> })
const ExpenseTracker   = dynamic(() => import('@/components/finance/ExpenseTracker'),   { loading: () => <Spinner /> })
const AIChat           = dynamic(() => import('@/components/shared/AIChat'),            { loading: () => <Spinner /> })

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )
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

const TABS = ['Overview', 'Budget', 'Goals', 'Tracker', 'Coach'] as const
type Tab = typeof TABS[number]

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [monthIdx, setMonthIdx] = useState(0)
  const selectedMonth = MONTHS[monthIdx]

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Finance</h1>
        <p className="text-slate-400 text-sm mt-1">Build wealth, reduce stress</p>
      </div>

      {/* Goals widget */}
      <GoalsWidget category="finance" />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-lg py-2 px-3 text-center text-sm font-medium transition-all',
              tab === t
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

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
            <ExpenseTracker start={selectedMonth.start} end={selectedMonth.end} />
          </div>
        </div>
      )}

      {tab === 'Coach' && <AIChat section="finance" />}
    </div>
  )
}
