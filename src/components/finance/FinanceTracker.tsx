'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Pencil, ArrowUpRight, ArrowDownRight, PiggyBank } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

type TxnType = 'expense' | 'income' | 'savings'

interface Transaction {
  id: string
  txn_date: string
  type: TxnType
  category: string
  amount: number
  description: string | null
}

const TYPE_CONFIG: Record<TxnType, { label: string; icon: typeof ArrowUpRight; color: string; badge: string }> = {
  income:  { label: 'Income',  icon: ArrowUpRight,   color: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  expense: { label: 'Expense', icon: ArrowDownRight, color: 'text-red-400',     badge: 'bg-red-500/20 text-red-300' },
  savings: { label: 'Savings', icon: PiggyBank,      color: 'text-sky-400',     badge: 'bg-sky-500/20 text-sky-300' },
}

const EXPENSE_CATEGORIES = ['Housing', 'Food', 'Transport', 'Healthcare', 'Entertainment', 'Shopping', 'Utilities', 'Education', 'Other']
const INCOME_CATEGORIES  = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other']
const SAVINGS_CATEGORIES = ['Emergency Fund', 'Retirement', 'Goal', 'Investment', 'Other']

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function TxnModal({ initial, onSave, trigger }: {
  initial?: Transaction
  onSave: () => void
  trigger: React.ReactNode
}) {
  const isEdit = !!initial
  const [open, setOpen]         = useState(false)
  const [type, setType]         = useState<TxnType>(initial?.type ?? 'expense')
  const [category, setCategory] = useState(initial?.category ?? EXPENSE_CATEGORIES[0])
  const [amount, setAmount]     = useState(initial ? String(initial.amount) : '')
  const [description, setDesc]  = useState(initial?.description ?? '')
  const [date, setDate]         = useState(initial?.txn_date ?? todayStr())
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (open && initial) {
      setType(initial.type); setCategory(initial.category)
      setAmount(String(initial.amount)); setDesc(initial.description ?? '')
      setDate(initial.txn_date)
    }
  }, [open, initial])

  const categories = type === 'income' ? INCOME_CATEGORIES : type === 'savings' ? SAVINGS_CATEGORIES : EXPENSE_CATEGORIES

  function handleTypeChange(t: TxnType) {
    setType(t)
    setCategory(t === 'income' ? INCOME_CATEGORIES[0] : t === 'savings' ? SAVINGS_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
  }

  async function handleSave() {
    if (!amount || !category) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    const payload = { txn_date: date, type, category, amount: Number(amount), description: description.trim() || null }
    if (isEdit) {
      await supabase.from('transactions').update(payload).eq('id', initial!.id)
    } else {
      await supabase.from('transactions').insert({ ...payload, user_id: session.user.id })
      setAmount(''); setDesc(''); setDate(todayStr())
    }
    setSaving(false)
    setOpen(false)
    onSave()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['expense', 'income', 'savings'] as TxnType[]).map(t => (
                <button key={t} type="button" onClick={() => handleTypeChange(t)}
                  className={cn('rounded-lg border py-2 text-sm font-medium capitalize transition-all',
                    type === t ? 'border-violet-500 bg-violet-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    category === c ? 'border-violet-500 bg-violet-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Amount (₹)</Label>
              <Input type="number" min="0.01" step="0.01" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Date</Label>
              <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 [color-scheme:dark]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Description (optional)</Label>
            <Input placeholder="e.g. Monthly rent" value={description} onChange={e => setDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>
          <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white" onClick={handleSave} disabled={saving || !amount}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Add Transaction'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function FinanceTracker() {
  const [txns, setTxns]         = useState<Transaction[]>([])
  const [loading, setLoading]   = useState(true)
  const [deletingId, setDel]    = useState<string | null>(null)

  const fetchTxns = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('txn_date', { ascending: false })
      .limit(30)
    setTxns((data as Transaction[]) ?? [])
    setLoading(false)
  }, [])

  async function deleteTxn(id: string) {
    setDel(id)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('transactions').delete().eq('id', id)
    setTxns(prev => prev.filter(t => t.id !== id))
    setDel(null)
  }

  useEffect(() => { fetchTxns() }, [fetchTxns])

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
          <h2 className="font-semibold text-white">Transactions</h2>
          <p className="text-xs text-slate-500 mt-0.5">Last 30 entries</p>
        </div>
        <TxnModal onSave={fetchTxns} trigger={
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
            <Plus className="h-4 w-4" /> Add
          </Button>
        } />
      </div>

      {txns.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <PiggyBank className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No transactions yet.</p>
          <p className="text-slate-600 text-xs mt-1">Add your income, expenses, and savings.</p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(byDate).map(([date, entries]) => {
          const dayTotal = entries.reduce((s, t) => {
            if (t.type === 'income') return s + Number(t.amount)
            return s - Number(t.amount)
          }, 0)

          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold text-slate-500">
                  {format(new Date(date + 'T12:00:00'), 'EEEE, MMM d')}
                </p>
                <p className={cn('text-xs font-medium', dayTotal >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {dayTotal >= 0 ? '+' : ''}₹{dayTotal.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1.5">
                {entries.map(txn => {
                  const cfg = TYPE_CONFIG[txn.type]
                  const Icon = cfg.icon
                  return (
                    <div
                      key={txn.id}
                      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-white/20 transition-all"
                    >
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5', cfg.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {txn.description ?? txn.category}
                        </p>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full', cfg.badge)}>
                          {txn.category}
                        </span>
                      </div>
                      <p className={cn('text-sm font-semibold shrink-0', cfg.color)}>
                        {txn.type === 'income' ? '+' : '-'}₹{Number(txn.amount).toLocaleString()}
                      </p>
                      <TxnModal initial={txn} onSave={fetchTxns} trigger={
                        <button type="button" aria-label="Edit transaction"
                          className="shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-violet-400 transition-all">
                          <Pencil className="h-4 w-4" />
                        </button>
                      } />
                      <button type="button" onClick={() => deleteTxn(txn.id)} disabled={deletingId === txn.id}
                        aria-label="Delete transaction"
                        className="shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all disabled:opacity-50">
                        {deletingId === txn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
