'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Plus, Trash2,
  UtensilsCrossed, Home, Car, Tv, Heart, ShoppingBag, Zap, Package,
  Briefcase, Laptop, TrendingUp, Gift, PiggyBank, Target, Shield,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────

type TxnType = 'expense' | 'income' | 'savings'

interface Transaction {
  id: string
  txn_date: string
  type: TxnType
  category: string
  amount: number
  description: string | null
}

// ─── Category config ──────────────────────────────────────────

interface CatStyle { icon: LucideIcon; color: string; bg: string }

const EXPENSE_CAT: Record<string, CatStyle> = {
  Food:          { icon: UtensilsCrossed, color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  Rent:          { icon: Home,            color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  Transport:     { icon: Car,             color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  Entertainment: { icon: Tv,              color: 'text-pink-400',    bg: 'bg-pink-500/15' },
  Healthcare:    { icon: Heart,           color: 'text-red-400',     bg: 'bg-red-500/15' },
  Shopping:      { icon: ShoppingBag,     color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  Utilities:     { icon: Zap,             color: 'text-yellow-400',  bg: 'bg-yellow-500/15' },
  Other:         { icon: Package,         color: 'text-slate-400',   bg: 'bg-slate-500/15' },
}

const INCOME_CAT: Record<string, CatStyle> = {
  Salary:     { icon: Briefcase,  color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  Freelance:  { icon: Laptop,     color: 'text-teal-400',    bg: 'bg-teal-500/15' },
  Investment: { icon: TrendingUp, color: 'text-sky-400',     bg: 'bg-sky-500/15' },
  Gift:       { icon: Gift,       color: 'text-pink-400',    bg: 'bg-pink-500/15' },
  Other:      { icon: Package,    color: 'text-slate-400',   bg: 'bg-slate-500/15' },
}

const SAVINGS_CAT: Record<string, CatStyle> = {
  'Emergency Fund': { icon: Shield,     color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  Retirement:       { icon: PiggyBank,  color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  Goal:             { icon: Target,     color: 'text-sky-400',     bg: 'bg-sky-500/15' },
  Investment:       { icon: TrendingUp, color: 'text-teal-400',    bg: 'bg-teal-500/15' },
  Other:            { icon: Package,    color: 'text-slate-400',   bg: 'bg-slate-500/15' },
}

function getCatStyle(type: TxnType, category: string): CatStyle {
  const map = type === 'income' ? INCOME_CAT : type === 'savings' ? SAVINGS_CAT : EXPENSE_CAT
  return map[category] ?? { icon: Package, color: 'text-slate-400', bg: 'bg-slate-500/15' }
}

const TYPE_SIGN: Record<TxnType, string> = { income: '+', expense: '-', savings: '→' }
const TYPE_AMOUNT_COLOR: Record<TxnType, string> = {
  income:  'text-emerald-400',
  expense: 'text-red-400',
  savings: 'text-sky-400',
}

// ─── Helpers ─────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ─── Add Transaction Modal ────────────────────────────────────

function AddModal({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen]         = useState(false)
  const [type, setType]         = useState<TxnType>('expense')
  const [category, setCategory] = useState<string>(Object.keys(EXPENSE_CAT)[0])
  const [amount, setAmount]     = useState('')
  const [description, setDesc]  = useState('')
  const [date, setDate]         = useState(todayStr())
  const [saving, setSaving]     = useState(false)
  const supabase = createSupabaseBrowserClient()

  const catKeys = type === 'income'
    ? Object.keys(INCOME_CAT)
    : type === 'savings'
      ? Object.keys(SAVINGS_CAT)
      : Object.keys(EXPENSE_CAT)

  function changeType(t: TxnType) {
    setType(t)
    const keys = t === 'income' ? Object.keys(INCOME_CAT) : t === 'savings' ? Object.keys(SAVINGS_CAT) : Object.keys(EXPENSE_CAT)
    setCategory(keys[0])
  }

  async function handleAdd() {
    const n = parseFloat(amount)
    if (!n || isNaN(n)) return
    setSaving(true)
    await supabase.from('transactions').insert({
      txn_date: date,
      type,
      category,
      amount: n,
      description: description.trim() || null,
    })
    setAmount(''); setDesc(''); setDate(todayStr())
    setSaving(false)
    setOpen(false)
    onAdd()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
          <Plus className="h-4 w-4" /> Add Transaction
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['expense', 'income', 'savings'] as TxnType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => changeType(t)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium capitalize transition-all',
                    type === t
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}
                >
                  {t === 'income'  && <ArrowUpRight className="h-3.5 w-3.5" />}
                  {t === 'expense' && <ArrowDownRight className="h-3.5 w-3.5" />}
                  {t === 'savings' && <PiggyBank className="h-3.5 w-3.5" />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {catKeys.map(c => {
                const style = getCatStyle(type, c)
                const Icon  = style.icon
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                      category === c
                        ? 'border-violet-500 bg-violet-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                    )}
                  >
                    <Icon className={cn('h-3 w-3', category === c ? '' : style.color)} />
                    {c}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Amount ($)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Date</Label>
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Description (optional)</Label>
            <Input
              placeholder="e.g. Grocery run"
              value={description}
              onChange={e => setDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleAdd}
            disabled={saving || !amount}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function ExpenseTracker() {
  const [txns, setTxns]       = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createSupabaseBrowserClient()

  const fetchTxns = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    setTxns((data as Transaction[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTxns() }, [fetchTxns])

  async function deleteTxn(id: string) {
    setDeletingId(id)
    await supabase.from('transactions').delete().eq('id', id)
    setTxns(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  // Group by date
  const byDate: Record<string, Transaction[]> = {}
  txns.forEach(t => {
    if (!byDate[t.txn_date]) byDate[t.txn_date] = []
    byDate[t.txn_date].push(t)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Transactions</h3>
          <p className="text-xs text-slate-500 mt-0.5">{txns.length} recent entries</p>
        </div>
        <AddModal onAdd={fetchTxns} />
      </div>

      {txns.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <PiggyBank className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No transactions yet.</p>
          <p className="text-slate-600 text-xs mt-1">Track your income, expenses, and savings.</p>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(byDate).map(([date, entries]) => {
          const dayNet = entries.reduce((s, t) => {
            if (t.type === 'income') return s + Number(t.amount)
            if (t.type === 'expense') return s - Number(t.amount)
            return s
          }, 0)

          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-2 px-0.5">
                <p className="text-xs font-semibold text-slate-500">
                  {format(new Date(date + 'T12:00:00'), 'EEEE, MMM d')}
                </p>
                <p className={cn('text-xs font-medium', dayNet >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {dayNet >= 0 ? '+' : ''}${dayNet.toLocaleString()}
                </p>
              </div>

              <div className="space-y-1.5">
                {entries.map(txn => {
                  const style = getCatStyle(txn.type, txn.category)
                  const Icon  = style.icon

                  return (
                    <div
                      key={txn.id}
                      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-white/20 transition-all"
                    >
                      {/* Icon */}
                      <div className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        style.bg
                      )}>
                        <Icon className={cn('h-4 w-4', style.color)} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {txn.description ?? txn.category}
                        </p>
                        <p className="text-xs text-slate-500">{txn.category}</p>
                      </div>

                      {/* Amount */}
                      <p className={cn('text-sm font-semibold shrink-0', TYPE_AMOUNT_COLOR[txn.type])}>
                        {TYPE_SIGN[txn.type]}${Number(txn.amount).toLocaleString()}
                      </p>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => deleteTxn(txn.id)}
                        disabled={deletingId === txn.id}
                        aria-label="Delete transaction"
                        className="ml-1 shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all disabled:opacity-50"
                      >
                        {deletingId === txn.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
