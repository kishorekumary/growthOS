'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Target, CheckSquare, Circle, Loader2 } from 'lucide-react'
import { differenceInDays, isBefore, parseISO, startOfDay } from 'date-fns'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { cn } from '@/lib/utils'

const SHOW_AFTER_MS = 3000
const MAX_ITEMS = 5

type GoalCategory = 'fitness' | 'finance' | 'books' | 'general' | 'career'

interface Goal {
  id: string
  title: string
  category: GoalCategory
  target_date: string | null
}

interface Todo {
  id: string
  title: string
  due_date: string | null
  is_completed: boolean
}

const CATEGORY_DOT: Record<GoalCategory, string> = {
  fitness: 'bg-emerald-400',
  finance: 'bg-sky-400',
  books:   'bg-amber-400',
  general: 'bg-violet-400',
  career:  'bg-rose-400',
}

function GoalsSection() {
  const { data: goals, loading, isOffline } = useCachedQuery<Goal[]>(
    'quick-reset:goals',
    (supabase, userId) => supabase
      .from('user_goals')
      .select('id, title, category, target_date')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('target_date', { ascending: true, nullsFirst: false }),
    [],
    []
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-amber-400" />
        <p className="text-sm font-semibold text-white">Active Goals</p>
        {goals.length > 0 && (
          <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
            {goals.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
      ) : goals.length === 0 && isOffline ? (
        <p className="text-xs text-slate-500 py-2">Can&apos;t load — you&apos;re offline.</p>
      ) : goals.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">No active goals yet.</p>
      ) : (
        <div className="space-y-1.5">
          {goals.slice(0, MAX_ITEMS).map(goal => {
            const days = goal.target_date ? differenceInDays(parseISO(goal.target_date), new Date()) : null
            return (
              <div key={goal.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_DOT[goal.category] ?? 'bg-slate-400')} />
                <span className="flex-1 min-w-0 text-sm text-slate-200 truncate">{goal.title}</span>
                {days !== null && (
                  <span className={cn(
                    'text-xs shrink-0 font-medium',
                    days < 0 ? 'text-red-400' : days <= 7 ? 'text-amber-400' : 'text-slate-500',
                  )}>
                    {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                  </span>
                )}
              </div>
            )
          })}
          {goals.length > MAX_ITEMS ? (
            <Link href="/goals" className="block text-center text-xs text-slate-500 hover:text-violet-400 transition-colors pt-0.5">
              +{goals.length - MAX_ITEMS} more · View all goals →
            </Link>
          ) : (
            <Link href="/goals" className="block text-center text-xs text-slate-500 hover:text-violet-400 transition-colors pt-0.5">
              View all goals →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function TodosSection() {
  const { data: todos, loading, isOffline, setData: setTodos } = useCachedQuery<Todo[]>(
    'quick-reset:todos',
    (supabase, userId) => supabase
      .from('user_todos')
      .select('id, title, due_date, is_completed')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    [],
    []
  )

  async function complete(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
    const supabase = createSupabaseBrowserClient()
    const now = new Date().toISOString()
    await supabase.from('user_todos').update({ is_completed: true, completed_at: now, updated_at: now }).eq('id', id)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-sky-400" />
        <p className="text-sm font-semibold text-white">Today&apos;s Tasks</p>
        {todos.length > 0 && (
          <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">
            {todos.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
      ) : todos.length === 0 && isOffline ? (
        <p className="text-xs text-slate-500 py-2">Can&apos;t load — you&apos;re offline.</p>
      ) : todos.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">All caught up — no pending tasks.</p>
      ) : (
        <div className="space-y-1.5">
          {todos.slice(0, MAX_ITEMS).map(todo => {
            const overdue = todo.due_date ? isBefore(parseISO(todo.due_date), startOfDay(new Date())) : false
            return (
              <button
                key={todo.id}
                onClick={() => complete(todo.id)}
                className="group w-full flex items-center gap-3 rounded-lg bg-white/5 hover:bg-sky-500/10 px-3 py-2.5 text-left transition-colors"
              >
                <Circle className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-sky-400 transition-colors" />
                <span className="flex-1 min-w-0 text-sm text-slate-200 group-hover:text-white transition-colors truncate">
                  {todo.title}
                </span>
                {overdue && <span className="text-xs shrink-0 font-medium text-red-400">Overdue</span>}
              </button>
            )
          })}
          {todos.length > MAX_ITEMS ? (
            <Link href="/todos" className="block text-center text-xs text-slate-500 hover:text-violet-400 transition-colors pt-0.5">
              +{todos.length - MAX_ITEMS} more · View all tasks →
            </Link>
          ) : (
            <Link href="/todos" className="block text-center text-xs text-slate-500 hover:text-violet-400 transition-colors pt-0.5">
              View all tasks →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default function OpeningBriefingModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
          <span className="text-sm font-semibold text-white">Your Day at a Glance</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-5">
          <GoalsSection />
          <TodosSection />
        </div>
      </div>
    </div>
  )
}
