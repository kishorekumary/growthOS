'use client'

import { useState, useCallback } from 'react'
import {
  Loader2, TrendingDown, PiggyBank, X, Calendar, FileText, Settings2,
  Plus, Trash2, Check, Pencil,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useFinanceCategories, type FinanceCategory } from '@/hooks/useFinanceCategories'
import { useCachedQuery } from '@/hooks/useCachedQuery'

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

interface SpendingTxn {
  category: string
  amount: number
  type: string
}

interface BudgetRow {
  budget: Budget
}

interface DrillTarget {
  name: string
  type: 'expense' | 'savings'
}

// ─── Constants ───────────────────────────────────────────────

const COLOR_PALETTE = [
  '#f97316', '#fb923c', '#fbbf24', '#facc15',
  '#a3e635', '#34d399', '#2dd4bf', '#22d3ee',
  '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa',
  '#c084fc', '#f472b6', '#fb7185', '#f87171',
  '#6b7280', '#10b981', '#0ea5e9', '#8b5cf6',
]

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
        {data.map(entry => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
          return (
            <button
              key={entry.name}
              onClick={() => onSliceClick(entry.name)}
              className="flex items-center gap-2 hover:bg-white/5 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors text-left"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorFn(entry.name) }} />
              <span className="text-xs text-slate-400 flex-1 truncate">{entry.name}</span>
              <span className="text-xs font-medium text-white">{pct}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Category manager modal ───────────────────────────────────

function CategoryManager({
  cats,
  onAdd,
  onUpdate,
  onRemove,
  onClose,
}: {
  cats: { expense: FinanceCategory[]; savings: FinanceCategory[] }
  onAdd: (type: 'expense' | 'savings', cat: FinanceCategory) => void
  onUpdate: (type: 'expense' | 'savings', oldName: string, updated: Partial<FinanceCategory>) => void
  onRemove: (type: 'expense' | 'savings', name: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'expense' | 'savings'>('expense')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#60a5fa')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editColor, setEditColor] = useState('')
  const [showNewPalette, setShowNewPalette] = useState(false)
  const [showEditPalette, setShowEditPalette] = useState<string | null>(null)

  const list = cats[tab]

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    onAdd(tab, { name, color: newColor })
    setNewName('')
    setShowNewPalette(false)
  }

  function startEdit(cat: FinanceCategory) {
    setEditingName(cat.name)
    setEditDraft(cat.name)
    setEditColor(cat.color)
    setShowEditPalette(null)
  }

  function commitEdit(oldName: string) {
    const name = editDraft.trim()
    if (name && (name !== oldName || editColor !== cats[tab].find(c => c.name === oldName)?.color)) {
      onUpdate(tab, oldName, { name, color: editColor })
    }
    setEditingName(null)
    setShowEditPalette(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 shrink-0">
          <div>
            <p className="font-semibold text-white">Manage Categories</p>
            <p className="text-xs text-slate-500 mt-0.5">Add, rename, recolor, or remove</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 shrink-0">
          {(['expense', 'savings'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setEditingName(null) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                tab === t
                  ? t === 'expense' ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent',
              )}>
              {t === 'expense' ? <TrendingDown className="h-3 w-3" /> : <PiggyBank className="h-3 w-3" />}
              {t === 'expense' ? 'Spending' : 'Savings'}
            </button>
          ))}
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {list.map(cat => (
            <div key={cat.name}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
              {/* Color swatch — click to change */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowEditPalette(showEditPalette === cat.name ? null : cat.name)}
                  className="h-7 w-7 rounded-full border-2 border-white/20 hover:border-white/50 transition-all"
                  style={{ backgroundColor: editingName === cat.name ? editColor : cat.color }}
                  title="Change color"
                />
                {showEditPalette === cat.name && editingName !== cat.name && (
                  <div className="absolute left-0 top-9 z-10 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl grid grid-cols-5 gap-1">
                    {COLOR_PALETTE.map(c => (
                      <button key={c} onClick={() => { onUpdate(tab, cat.name, { color: c }); setShowEditPalette(null) }}
                        className={cn('h-5 w-5 rounded-full border transition-all hover:scale-110',
                          cat.color === c ? 'border-white' : 'border-transparent')}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Name — click pencil to edit */}
              {editingName === cat.name ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    autoFocus
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit(cat.name)
                      if (e.key === 'Escape') setEditingName(null)
                    }}
                    className="flex-1 bg-transparent text-sm text-white focus:outline-none border-b border-violet-500 pb-0.5"
                  />
                  {/* Inline color picker when editing */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEditPalette(showEditPalette === `edit-${cat.name}` ? null : `edit-${cat.name}`)}
                      className="h-5 w-5 rounded-full border border-white/30"
                      style={{ backgroundColor: editColor }}
                    />
                    {showEditPalette === `edit-${cat.name}` && (
                      <div className="absolute right-0 top-7 z-10 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl grid grid-cols-5 gap-1">
                        {COLOR_PALETTE.map(c => (
                          <button key={c} onClick={() => { setEditColor(c); setShowEditPalette(null) }}
                            className={cn('h-5 w-5 rounded-full border transition-all hover:scale-110',
                              editColor === c ? 'border-white' : 'border-transparent')}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => commitEdit(cat.name)}
                    className="p-1 rounded-md bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditingName(null)}
                    className="p-1 rounded-md text-slate-500 hover:text-white transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm text-white truncate">{cat.name}</span>
                  <button onClick={() => startEdit(cat)}
                    className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-all">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onRemove(tab, cat.name)}
                    disabled={list.length <= 1}
                    className="p-1.5 rounded-md text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new category */}
        <div className="px-5 py-4 border-t border-white/10 shrink-0 space-y-2">
          <p className="text-xs text-slate-500 font-medium">Add category</p>
          <div className="flex items-center gap-2">
            {/* Color picker for new */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowNewPalette(!showNewPalette)}
                className="h-8 w-8 rounded-full border-2 border-white/20 hover:border-white/50 transition-all"
                style={{ backgroundColor: newColor }}
              />
              {showNewPalette && (
                <div className="absolute left-0 bottom-10 z-10 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl grid grid-cols-5 gap-1">
                  {COLOR_PALETTE.map(c => (
                    <button key={c} onClick={() => { setNewColor(c); setShowNewPalette(false) }}
                      className={cn('h-5 w-5 rounded-full border transition-all hover:scale-110',
                        newColor === c ? 'border-white' : 'border-transparent')}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
            </div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Category name"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
            <button onClick={handleAdd} disabled={!newName.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-white transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div>
              <p className="font-semibold text-white text-base">{target.name}</p>
              <p className="text-xs text-slate-400">{isExpense ? 'Expenses' : 'Savings'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className={cn('text-lg font-bold', isExpense ? 'text-red-400' : 'text-emerald-400')}>
              ₹{total.toLocaleString()}
            </p>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

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
              <div key={txn.id} className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/8 px-4 py-3">
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
  const { cats, addCategory, removeCategory, updateCategory, colorFor } = useFinanceCategories()

  const {
    data: spendingTxns,
    loading: txnsLoading,
    isOffline: txnsOffline,
  } = useCachedQuery<SpendingTxn[]>(
    `spending:${start}:${end}`,
    (supabase, userId) => supabase
      .from('transactions')
      .select('category, amount, type')
      .eq('user_id', userId)
      .gte('txn_date', start)
      .lte('txn_date', end),
    [],
    [start, end]
  )

  const {
    data: budgetRow,
    loading: budgetLoading,
  } = useCachedQuery<BudgetRow | null>(
    `budget:${start}:${end}`,
    (supabase, userId) => supabase
      .from('budgets')
      .select('budget')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    null,
    [start, end]
  )

  const budget = budgetRow?.budget ?? null
  const loading = txnsLoading || budgetLoading

  const expenseTotals: Record<string, number> = {}
  spendingTxns.filter(t => t.type === 'expense').forEach(t => {
    expenseTotals[t.category] = (expenseTotals[t.category] ?? 0) + Number(t.amount)
  })

  const savingsTotals: Record<string, number> = {}
  spendingTxns.filter(t => t.type === 'savings').forEach(t => {
    savingsTotals[t.category] = (savingsTotals[t.category] ?? 0) + Number(t.amount)
  })

  const [drillTarget, setDrillTarget]   = useState<DrillTarget | null>(null)
  const [drillTxns, setDrillTxns]       = useState<Transaction[]>([])
  const [drillLoading, setDrillLoading] = useState(false)
  const [showCatMgr, setShowCatMgr]     = useState(false)

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

  const totalSpent = Object.values(expenseTotals).reduce((s, v) => s + v, 0)
  const totalSaved = Object.values(savingsTotals).reduce((s, v) => s + v, 0)

  // Merge known categories + any categories from actual transactions (for legacy data)
  const knownExpenseNames = cats.expense.map(c => c.name)
  const allExpenseNames = Array.from(new Set([...knownExpenseNames, ...Object.keys(expenseTotals)]))
  const expensePieData = allExpenseNames
    .filter(n => expenseTotals[n] > 0)
    .sort((a, b) => (expenseTotals[b] ?? 0) - (expenseTotals[a] ?? 0))
    .map(name => ({ name, value: expenseTotals[name] }))

  const knownSavingsNames = cats.savings.map(c => c.name)
  const allSavingsNames = Array.from(new Set([...knownSavingsNames, ...Object.keys(savingsTotals)]))
  const savingsPieData = allSavingsNames
    .filter(n => savingsTotals[n] > 0)
    .sort((a, b) => (savingsTotals[b] ?? 0) - (savingsTotals[a] ?? 0))
    .map(name => ({ name, value: savingsTotals[name] }))

  const drillTotal = drillTarget
    ? drillTarget.type === 'expense' ? (expenseTotals[drillTarget.name] ?? 0) : (savingsTotals[drillTarget.name] ?? 0)
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
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                Spending Breakdown
              </h3>
              <button onClick={() => setShowCatMgr(true)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                <Settings2 className="h-3.5 w-3.5" /> Categories
              </button>
            </div>

            {totalSpent === 0 && txnsOffline ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                <p className="text-slate-400 text-sm">Can&apos;t load — you&apos;re offline.</p>
              </div>
            ) : totalSpent === 0 ? (
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
                    colorFn={name => colorFor('expense', name)}
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
                    <p className="text-xs text-slate-500">Generate a budget in the Budget tab to see comparisons.</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Savings chart ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-emerald-400" />
                Savings Breakdown
              </h3>
              <button onClick={() => setShowCatMgr(true)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                <Settings2 className="h-3.5 w-3.5" /> Categories
              </button>
            </div>

            {totalSaved === 0 && txnsOffline ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                <p className="text-slate-400 text-sm">Can&apos;t load — you&apos;re offline.</p>
              </div>
            ) : totalSaved === 0 ? (
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
                    colorFn={name => colorFor('savings', name)}
                    onSliceClick={name => openDrill(name, 'savings')}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Category manager modal ── */}
      {showCatMgr && (
        <CategoryManager
          cats={cats}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onRemove={removeCategory}
          onClose={() => setShowCatMgr(false)}
        />
      )}

      {/* ── Drill-down panel ── */}
      {drillTarget && (
        <CategoryDrillDown
          target={drillTarget}
          transactions={drillTxns}
          loading={drillLoading}
          total={drillTotal}
          colorFn={name => colorFor(drillTarget.type, name)}
          onClose={() => { setDrillTarget(null); setDrillTxns([]) }}
        />
      )}
    </div>
  )
}
