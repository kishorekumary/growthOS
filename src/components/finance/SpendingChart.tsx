'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, TrendingDown, PiggyBank, X, Calendar, FileText } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────

interface BudgetItem { name: string; amount: number }
interface Budget {
  needs?:   { items: BudgetItem[] }
  wants?:   { items: BudgetItem[] }
  savings?: { items: BudgetItem[] }
}

interface Transaction {
  id: string
  txn_date: string
  amount: number
  description: string | null
  category: string
  type: string
}

interface DrillTarget {
  name: string
  type: 'expense' | 'savings'
}

// ─── Constants ───────────────────────────────────────────────

const EXPENSE_COLORS: Record<string, string> = {
  Food:          '#f97316',
  Rent:          '#a78bfa',
  Transport:     '#60a5fa',
  Entertainment: '#f472b6',
  Healthcare:    '#f87171',
  Shopping:      '#fbbf24',
  Utilities:     '#34d399',
  Other:         '#6b7280',
}

const SAVINGS_COLORS: Record<string, string> = {
  'Emergency Fund': '#10b981',
  Retirement:       '#a78bfa',
  Goal:             '#38bdf8',
  Investment:       '#2dd4bf',
  Other:            '#6b7280',
}

function expenseColor(name: string) { return EXPENSE_COLORS[name] ?? '#6b7280' }
function savingsColor(name: string) { return SAVINGS_COLORS[name] ?? '#10b981' }

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

// ─── Budget fuzzy match ───────────────────────────────────────

function findBudgeted(category: string, budget: Budget | null): number {
  if (!budget) return 0
  const allItems = [
    ...(budget.needs?.items ?? []),
    ...(budget.wants?.items ?? []),
  ]
  const cat = category.toLowerCase()
  const match = allItems.find(b =>
    b.name.toLowerCase().includes(cat) || cat.includes(b.name.toLowerCase())
  )
  return match?.amount ?? 0
}

// ─── Custom tooltip ───────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-slate-400">₹{payload[0].value.toLocaleString()}</p>
      <p className="text-slate-500 text-[11px] mt-0.5">Click to see transactions</p>
    </div>
  )
}

// ─── Donut chart + legend ─────────────────────────────────────

interface PieEntry { name: string; value: number }

function DonutChart({
  data,
  total,
  colorFn,
  onSliceClick,
}: {
  data: PieEntry[]
  total: number
  colorFn: (name: string) => string
  onSliceClick: (name: string) => void
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={88}
            paddingAngle={2}
            dataKey="value"
            cursor="pointer"
            onClick={(_, index) => onSliceClick(data[index].name)}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={colorFn(entry.name)}
                opacity={activeIndex === null || activeIndex === i ? 1 : 0.5}
                stroke={activeIndex === i ? 'rgba(255,255,255,0.4)' : 'transparent'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
        {data.map((entry, i) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
          return (
            <button
              key={entry.name}
              onClick={() => onSliceClick(entry.name)}
              className="flex items-center gap-2 hover:bg-white/5 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors text-left"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorFn(entry.name) }}
              />
              <span className="text-xs text-slate-400 flex-1 truncate">{entry.name}</span>
              <span className="text-xs font-medium text-white">{pct}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Category drill-down panel ────────────────────────────────

function CategoryDrillDown({
  target,
  transactions,
  loading,
  total,
  colorFn,
  onClose,
}: {
  target: DrillTarget
  transactions: Transaction[]
  loading: boolean
  total: number
  colorFn: (name: string) => string
  onClose: () => void
}) {
  const color = colorFn(target.name)
  const isExpense = target.type === 'expense'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="h-3.5 w-3.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <div>
              <p className="font-semibold text-white text-base">{target.name}</p>
              <p className="text-xs text-slate-400">{isExpense ? 'Expenses' : 'Savings'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p
              className={cn('text-lg font-bold', isExpense ? 'text-red-400' : 'text-emerald-400')}
            >
              ₹{total.toLocaleString()}
            </p>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-400 text-sm">No transactions found.</p>
            </div>
          ) : (
            transactions.map(txn => (
              <div
                key={txn.id}
                className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/8 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>{new Date(txn.txn_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  {txn.description ? (
                    <p className="text-sm text-slate-200 flex items-center gap-1.5">
                      <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                      <span className="truncate">{txn.description}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No description</p>
                  )}
                </div>
                <p className={cn('text-sm font-semibold shrink-0', isExpense ? 'text-red-400' : 'text-emerald-400')}>
                  ₹{Number(txn.amount).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Count footer */}
        {!loading && transactions.length > 0 && (
          <div className="px-5 py-3 border-t border-white/10 shrink-0">
            <p className="text-xs text-slate-500 text-center">
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function SpendingChart({ start, end }: { start: string; end: string }) {
  const [expenseTotals, setExpenseTotals] = useState<Record<string, number>>({})
  const [savingsTotals, setSavingsTotals] = useState<Record<string, number>>({})
  const [budget, setBudget]              = useState<Budget | null>(null)
  const [loading, setLoading]            = useState(true)

  // Drill-down state
  const [drillTarget, setDrillTarget]       = useState<DrillTarget | null>(null)
  const [drillTxns, setDrillTxns]           = useState<Transaction[]>([])
  const [drillLoading, setDrillLoading]     = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }

    const [{ data: expenseTxns }, { data: savingsTxns }, { data: budgetRow }] = await Promise.all([
      supabase
        .from('transactions')
        .select('category, amount')
        .eq('user_id', session.user.id)
        .eq('type', 'expense')
        .gte('txn_date', start)
        .lte('txn_date', end),
      supabase
        .from('transactions')
        .select('category, amount')
        .eq('user_id', session.user.id)
        .eq('type', 'savings')
        .gte('txn_date', start)
        .lte('txn_date', end),
      supabase
        .from('budgets')
        .select('budget')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const eTotals: Record<string, number> = {}
    ;(expenseTxns ?? []).forEach(t => {
      eTotals[t.category] = (eTotals[t.category] ?? 0) + Number(t.amount)
    })

    const sTotals: Record<string, number> = {}
    ;(savingsTxns ?? []).forEach(t => {
      sTotals[t.category] = (sTotals[t.category] ?? 0) + Number(t.amount)
    })

    setExpenseTotals(eTotals)
    setSavingsTotals(sTotals)
    setBudget(budgetRow?.budget as Budget ?? null)
    setLoading(false)
  }, [start, end])

  useEffect(() => { fetchData() }, [fetchData])

  const openDrill = useCallback(async (name: string, type: 'expense' | 'savings') => {
    setDrillTarget({ name, type })
    setDrillLoading(true)
    setDrillTxns([])

    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setDrillLoading(false); return }

    const { data } = await supabase
      .from('transactions')
      .select('id, txn_date, amount, description, category, type')
      .eq('user_id', session.user.id)
      .eq('type', type)
      .eq('category', name)
      .gte('txn_date', start)
      .lte('txn_date', end)
      .order('txn_date', { ascending: false })

    setDrillTxns(data ?? [])
    setDrillLoading(false)
  }, [start, end])

  const totalSpent  = Object.values(expenseTotals).reduce((s, v) => s + v, 0)
  const totalSaved  = Object.values(savingsTotals).reduce((s, v) => s + v, 0)

  const expensePieData: PieEntry[] = Object.entries(expenseTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }))

  const savingsPieData: PieEntry[] = Object.entries(savingsTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }))

  const hasExpenses = totalSpent > 0
  const hasSavings  = totalSaved > 0

  const drillTotal = drillTarget
    ? drillTarget.type === 'expense'
      ? (expenseTotals[drillTarget.name] ?? 0)
      : (savingsTotals[drillTarget.name] ?? 0)
    : 0

  return (
    <div className="space-y-6">

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          {/* ── Spending chart ── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              Spending Breakdown
            </h3>

            {!hasExpenses ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                <p className="text-slate-400 text-sm">No expenses recorded for this period.</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-slate-400">Total spent</p>
                  <p className="text-lg font-bold text-red-400">₹{totalSpent.toLocaleString()}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <DonutChart
                    data={expensePieData}
                    total={totalSpent}
                    colorFn={expenseColor}
                    onSliceClick={name => openDrill(name, 'expense')}
                  />
                </div>

                {/* Budget comparison */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <p className="text-sm font-medium text-white">vs Budget</p>
                  {budget ? (
                    <div className="space-y-2">
                      {expensePieData.map(({ name: cat, value: actual }) => {
                        const budgeted = findBudgeted(cat, budget)
                        const over = budgeted > 0 ? actual - budgeted : null
                        const pct  = budgeted > 0 ? Math.min(120, Math.round((actual / budgeted) * 100)) : null
                        return (
                          <div key={cat}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-300">{cat}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">₹{actual.toLocaleString()}</span>
                                {budgeted > 0 && (
                                  <span className={cn('font-medium', over !== null && over > 0 ? 'text-red-400' : 'text-emerald-400')}>
                                    {over !== null && over > 0
                                      ? `+₹${over.toLocaleString()} over`
                                      : `₹${(budgeted - actual).toLocaleString()} left`}
                                  </span>
                                )}
                              </div>
                            </div>
                            {budgeted > 0 && pct !== null && (
                              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all', pct > 100 ? 'bg-red-500' : 'bg-emerald-500')}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Generate a budget in the Budget tab to see comparisons.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Savings chart ── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-emerald-400" />
              Savings Breakdown
            </h3>

            {!hasSavings ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                <p className="text-slate-400 text-sm">No savings recorded for this period.</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-slate-400">Total saved</p>
                  <p className="text-lg font-bold text-emerald-400">₹{totalSaved.toLocaleString()}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <DonutChart
                    data={savingsPieData}
                    total={totalSaved}
                    colorFn={savingsColor}
                    onSliceClick={name => openDrill(name, 'savings')}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Drill-down panel ── */}
      {drillTarget && (
        <CategoryDrillDown
          target={drillTarget}
          transactions={drillTxns}
          loading={drillLoading}
          total={drillTotal}
          colorFn={drillTarget.type === 'expense' ? expenseColor : savingsColor}
          onClose={() => { setDrillTarget(null); setDrillTxns([]) }}
        />
      )}
    </div>
  )
}
