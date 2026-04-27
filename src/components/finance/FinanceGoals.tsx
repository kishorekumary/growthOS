'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Target } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Goal {
  id: string
  goal_name: string
  goal_type: string
  target_amount: number
  current_amount: number
  deadline_date: string | null
  is_completed: boolean
}

const GOAL_TYPES = ['Emergency Fund', 'House', 'Car', 'Vacation', 'Retirement', 'Education', 'Business', 'Other']

function progressColor(pct: number) {
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 60)  return 'bg-violet-500'
  if (pct >= 30)  return 'bg-sky-500'
  return 'bg-orange-500'
}

function AddGoalModal({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen]           = useState(false)
  const [name, setName]           = useState('')
  const [type, setType]           = useState(GOAL_TYPES[0])
  const [target, setTarget]       = useState('')
  const [deadline, setDeadline]   = useState('')
  const [saving, setSaving]       = useState(false)

  async function handleAdd() {
    if (!name.trim() || !target) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    await supabase.from('finance_goals').insert({
      user_id: session.user.id,
      goal_name: name.trim(),
      goal_type: type,
      target_amount: Number(target),
      deadline_date: deadline || null,
    })
    setName(''); setType(GOAL_TYPES[0]); setTarget(''); setDeadline('')
    setSaving(false)
    setOpen(false)
    onAdd()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
          <Plus className="h-4 w-4" /> Add Goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Savings Goal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Goal name</Label>
            <Input
              autoFocus
              placeholder="e.g. Emergency Fund"
              value={name}
              onChange={e => setName(e.target.value)}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Type</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {GOAL_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'rounded-lg border py-1.5 px-2 text-xs font-medium transition-all',
                    type === t
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Target amount (₹)</Label>
              <Input
                type="number"
                min="1"
                placeholder="10000"
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Deadline (optional)</Label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleAdd}
            disabled={saving || !name.trim() || !target}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Goal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AddMoneyModal({ goal, onUpdate }: { goal: Goal; onUpdate: () => void }) {
  const [open, setOpen]   = useState(false)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    const n = Number(amount)
    if (!n || isNaN(n)) return
    setSaving(true)
    const newAmount = goal.current_amount + n
    const isCompleted = newAmount >= goal.target_amount
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('finance_goals')
      .update({
        current_amount: newAmount,
        is_completed: isCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goal.id)
    setAmount('')
    setSaving(false)
    setOpen(false)
    onUpdate()
  }

  const remaining = goal.target_amount - goal.current_amount

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors border border-violet-500/30 rounded-lg px-2.5 py-1 hover:border-violet-500/50"
        >
          + Add Money
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to "{goal.goal_name}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            ₹{goal.current_amount.toLocaleString()} saved · ₹{remaining.toLocaleString()} remaining
          </p>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Amount to add ($)</Label>
            <Input
              autoFocus
              type="number"
              min="1"
              placeholder="e.g. 500"
              value={amount}
              onChange={e => setAmount(e.target.value)}
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
            Add Money
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function FinanceGoals() {
  const [goals, setGoals]   = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGoals = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const { data } = await supabase
      .from('finance_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
    setGoals((data as Goal[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const active    = goals.filter(g => !g.is_completed)
  const completed = goals.filter(g => g.is_completed)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Savings Goals</h2>
          {goals.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {active.length} active · {completed.length} completed
            </p>
          )}
        </div>
        <AddGoalModal onAdd={fetchGoals} />
      </div>

      {goals.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <Target className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No goals yet.</p>
          <p className="text-slate-600 text-xs mt-1">Add a goal to start tracking your progress.</p>
        </div>
      )}

      <div className="space-y-3">
        {active.map(goal => {
          const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
          return (
            <div key={goal.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{goal.goal_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{goal.goal_type}</p>
                </div>
                <AddMoneyModal goal={goal} onUpdate={fetchGoals} />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">
                    ₹{goal.current_amount.toLocaleString()} of ₹{goal.target_amount.toLocaleString()}
                  </span>
                  <span className="font-semibold text-white">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', progressColor(pct))}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {goal.deadline_date && (
                <p className="text-xs text-slate-600">
                  🎯 Deadline: {format(new Date(goal.deadline_date + 'T12:00:00'), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completed</p>
          {completed.map(goal => (
            <div key={goal.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 line-through">{goal.goal_name}</p>
                <p className="text-xs text-emerald-400">✓ ₹{goal.target_amount.toLocaleString()} reached</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
