'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const FinanceOverview  = dynamic(() => import('@/components/finance/FinanceOverview'),  { loading: () => <Spinner /> })
const FinanceBudget    = dynamic(() => import('@/components/finance/FinanceBudget'),    { loading: () => <Spinner /> })
const FinanceGoals     = dynamic(() => import('@/components/finance/FinanceGoals'),     { loading: () => <Spinner /> })
const SpendingChart    = dynamic(() => import('@/components/finance/SpendingChart'),    { loading: () => <Spinner /> })
const ExpenseTracker   = dynamic(() => import('@/components/finance/ExpenseTracker'),   { loading: () => <Spinner /> })
const FinanceCoach     = dynamic(() => import('@/components/finance/FinanceCoach'),     { loading: () => <Spinner /> })

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )
}

const TABS = ['Overview', 'Budget', 'Goals', 'Tracker', 'Coach'] as const
type Tab = typeof TABS[number]

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('Overview')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Finance</h1>
        <p className="text-slate-400 text-sm mt-1">Build wealth, reduce stress</p>
      </div>

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
      {tab === 'Tracker'  && (
        <div className="space-y-8">
          <SpendingChart />
          <div className="border-t border-white/10 pt-6">
            <ExpenseTracker />
          </div>
        </div>
      )}
      {tab === 'Coach'    && <FinanceCoach />}
    </div>
  )
}
