'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Sparkles, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface FinancialProfile {
  monthly_income: number | null
  monthly_expenses: Record<string, number>
  total_savings: number | null
  total_debt: number | null
  financial_score: number | null
}

interface Transaction {
  amount: number
  category: string
  type: string
}

function scoreColor(s: number) {
  if (s < 40) return 'text-red-400'
  if (s < 70) return 'text-yellow-400'
  return 'text-emerald-400'
}
function scoreBg(s: number) {
  if (s < 40) return 'from-red-500/10 to-red-500/5 border-red-500/20'
  if (s < 70) return 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20'
  return 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
}
function scoreLabel(s: number) {
  if (s < 40) return 'Needs Attention'
  if (s < 70) return 'Making Progress'
  return 'In Great Shape'
}

const TICK = { fill: '#94a3b8', fontSize: 11 }
const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}
const BAR_COLORS = ['#a78bfa', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3']

export default function FinanceOverview() {
  const [profile, setProfile]     = useState<FinancialProfile | null>(null)
  const [txns, setTxns]           = useState<Transaction[]>([])
  const [loading, setLoading]     = useState(true)
  const [scoring, setScoring]     = useState(false)
  const [scoreInfo, setScoreInfo] = useState<{ explanation: string; tips: string[] } | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }

    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('financial_profile')
        .select('monthly_income, monthly_expenses, total_savings, total_debt, financial_score')
        .eq('user_id', session.user.id)
        .maybeSingle(),
      supabase.from('transactions')
        .select('amount, category, type')
        .eq('user_id', session.user.id)
        .gte('txn_date', monthStartStr),
    ])
    setProfile(p as FinancialProfile ?? null)
    setTxns(t ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function refreshScore() {
    setScoring(true)
    const res = await fetch('/api/ai/financial-health-score', { method: 'POST' })
    const data = await res.json()
    setProfile(prev => prev ? { ...prev, financial_score: data.score } : prev)
    setScoreInfo({ explanation: data.explanation, tips: data.tips ?? [] })
    setScoring(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const income   = Number(profile?.monthly_income ?? 0)
  const savings  = Number(profile?.total_savings ?? 0)
  const debt     = Number(profile?.total_debt ?? 0)
  const score    = profile?.financial_score ?? null

  // Monthly expenses: from actual transactions + JSONB fallback
  const expenseTxnTotal = txns
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)
  const expenses = expenseTxnTotal > 0
    ? expenseTxnTotal
    : Object.values(profile?.monthly_expenses ?? {}).reduce((s: number, v) => s + Number(v), 0)

  const savingsRate = income > 0 ? Math.round((savings / (income * 12)) * 100) : 0

  // Category chart data
  const catMap: Record<string, number> = {}
  txns.filter(t => t.type === 'expense').forEach(t => {
    catMap[t.category] = (catMap[t.category] ?? 0) + Number(t.amount)
  })
  // Fall back to monthly_expenses JSONB if no transactions
  if (Object.keys(catMap).length === 0 && profile?.monthly_expenses) {
    Object.entries(profile.monthly_expenses).forEach(([k, v]) => {
      catMap[k] = Number(v)
    })
  }
  const categoryData = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, amount]) => ({ name, amount }))

  const maxBar = Math.max(income, expenses, 1)

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-white">Overview</h2>

      {/* Health Score */}
      <div className={cn(
        'rounded-xl border bg-gradient-to-br p-5',
        score !== null ? scoreBg(score) : 'border-white/10 from-white/5 to-white/3'
      )}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Financial Health Score
            </p>
            {score !== null ? (
              <>
                <p className={cn('text-5xl font-bold', scoreColor(score))}>{score}</p>
                <p className={cn('text-sm font-medium mt-1', scoreColor(score))}>{scoreLabel(score)}</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-slate-500">—</p>
            )}
          </div>
          <Button
            size="sm"
            onClick={refreshScore}
            disabled={scoring}
            className="bg-white/10 hover:bg-white/15 text-white border border-white/10 gap-1.5 shrink-0"
          >
            {scoring
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating...</>
              : <><RefreshCw className="h-3.5 w-3.5" /> {score !== null ? 'Refresh' : 'Calculate'}</>
            }
          </Button>
        </div>

        {scoreInfo?.explanation && (
          <p className="text-sm text-slate-300 mt-3 leading-relaxed">{scoreInfo.explanation}</p>
        )}
        {scoreInfo?.tips && scoreInfo.tips.length > 0 && (
          <ul className="mt-3 space-y-1">
            {scoreInfo.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <Sparkles className="h-3 w-3 text-violet-400 mt-0.5 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Income vs Expenses */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <p className="text-sm font-medium text-white">This Month</p>
        <div className="space-y-2">
          {[
            { label: 'Income', value: income, color: 'bg-emerald-500', icon: TrendingUp, iconColor: 'text-emerald-400' },
            { label: 'Expenses', value: expenses, color: 'bg-red-500', icon: TrendingDown, iconColor: 'text-red-400' },
          ].map(({ label, value, color, icon: Icon, iconColor }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Icon className={cn('h-3.5 w-3.5', iconColor)} />
                  {label}
                </span>
                <span className="text-sm font-semibold text-white">
                  ₹{value.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', color)}
                  style={{ width: `${Math.round((value / maxBar) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {income > 0 && (
          <p className={cn('text-xs font-medium', income >= expenses ? 'text-emerald-400' : 'text-red-400')}>
            Net: {income >= expenses ? '+' : ''}₹{(income - expenses).toLocaleString()}/mo
          </p>
        )}
      </div>

      {/* Top Spending Categories */}
      {categoryData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-sm font-medium text-white">Top Spending Categories</p>
          <ResponsiveContainer width="100%" height={categoryData.length * 36 + 20}>
            <BarChart layout="vertical" data={categoryData} barSize={14}>
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`₹${v}`, 'Amount']} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Savings Rate', value: `${savingsRate}%`, sub: 'of annual income' },
          { label: 'Total Savings', value: `₹${savings.toLocaleString()}`, sub: '' },
          { label: 'Total Debt',    value: `₹${debt.toLocaleString()}`,    sub: '' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <p className="text-lg font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            {sub && <p className="text-xs text-slate-600">{sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
