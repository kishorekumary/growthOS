'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Sparkles, RefreshCw, Check, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface BudgetItem {
  name: string
  amount: number
}

interface BudgetCategory {
  label: string
  percentage: number
  amount: number
  items: BudgetItem[]
}

interface Budget {
  needs: BudgetCategory
  wants: BudgetCategory
  savings: BudgetCategory
}

const CATEGORY_STYLES = {
  needs:   { color: 'text-sky-300',     bar: 'bg-sky-500',     border: 'border-sky-500/20',     bg: 'bg-sky-500/5' },
  wants:   { color: 'text-violet-300',  bar: 'bg-violet-500',  border: 'border-violet-500/20',  bg: 'bg-violet-500/5' },
  savings: { color: 'text-emerald-300', bar: 'bg-emerald-500', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
} as const

type CategoryKey = keyof typeof CATEGORY_STYLES

function EditableAmount({
  value,
  onSave,
}: {
  value: number
  onSave: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(String(value))

  function commit() {
    const n = Number(draft)
    if (!isNaN(n) && n >= 0) onSave(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 rounded border border-violet-500 bg-slate-800 px-2 py-0.5 text-xs text-white focus:outline-none"
        />
        <button type="button" onClick={commit} className="text-emerald-400 hover:text-emerald-300">
          <Check className="h-3 w-3" />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-slate-500 hover:text-slate-400">
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      className="text-sm font-medium text-white hover:text-violet-300 transition-colors"
      title="Click to edit"
    >
      ${value.toLocaleString()}
    </button>
  )
}

export default function FinanceBudget() {
  const [budget, setBudget]       = useState<Budget | null>(null)
  const [budgetDate, setBudgetDate] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const supabase = createSupabaseBrowserClient()

  const fetchBudget = useCallback(async () => {
    const { data } = await supabase
      .from('budgets')
      .select('budget, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setBudget(data.budget as Budget)
      setBudgetDate(data.created_at)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchBudget() }, [fetchBudget])

  async function createBudget() {
    setGenerating(true)
    const res = await fetch('/api/ai/finance-budget', { method: 'POST' })
    const data = await res.json()
    if (data.budget) {
      setBudget(data.budget)
      fetchBudget()
    }
    setGenerating(false)
  }

  function updateItem(cat: CategoryKey, idx: number, newAmount: number) {
    if (!budget) return
    const updated: Budget = {
      ...budget,
      [cat]: {
        ...budget[cat],
        items: budget[cat].items.map((item, i) =>
          i === idx ? { ...item, amount: newAmount } : item
        ),
      },
    }
    setBudget(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">50/30/20 Budget</h2>
          {budgetDate && (
            <p className="text-xs text-slate-500 mt-0.5">
              Generated {format(new Date(budgetDate), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={createBudget}
          disabled={generating}
          className={cn(
            'gap-1.5',
            budget
              ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          )}
          variant={budget ? 'outline' : 'default'}
        >
          {generating
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            : budget
              ? <><RefreshCw className="h-4 w-4" /> Regenerate</>
              : <><Sparkles className="h-4 w-4" /> Create Budget</>
          }
        </Button>
      </div>

      {!budget ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Sparkles className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No budget yet.</p>
          <p className="text-slate-600 text-xs mt-1">
            Generate a personalised 50/30/20 plan based on your income.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(['needs', 'wants', 'savings'] as CategoryKey[]).map((key) => {
            const cat  = budget[key]
            const style = CATEGORY_STYLES[key]
            return (
              <div key={key} className={cn('rounded-xl border p-4 space-y-3', style.border, style.bg)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn('text-sm font-semibold', style.color)}>{cat.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ${cat.amount.toLocaleString()} / month
                    </p>
                  </div>
                  <span className={cn('text-2xl font-bold', style.color)}>
                    {cat.percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', style.bar)}
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>

                {/* Line items */}
                <div className="space-y-1.5 pt-1">
                  {cat.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{item.name}</span>
                      <EditableAmount
                        value={item.amount}
                        onSave={(v) => updateItem(key, i, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
