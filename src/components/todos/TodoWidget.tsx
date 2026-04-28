'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Check, ArrowRight, Loader2, CheckSquare } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { format, isToday, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns'
import { cn } from '@/lib/utils'

interface Todo {
  id: string
  title: string
  notes: string | null
  due_date: string | null
  is_completed: boolean
}

export default function TodoWidget() {
  const [todos, setTodos]     = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving]     = useState(false)

  const fetchTodos = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('user_todos')
      .select('id, title, notes, due_date, is_completed')
      .eq('is_completed', false)
      .or(`due_date.is.null,due_date.lte.${todayStr}`)
      .order('due_date', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(6)
    setTodos((data as Todo[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  async function handleAdd() {
    if (!newTitle.trim() || saving) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('user_todos')
      .insert({
        user_id:  user.id,
        title:    newTitle.trim(),
        due_date: todayStr,
      })
      .select('id, title, notes, due_date, is_completed')
      .single()
    setNewTitle('')
    setSaving(false)
    if (data) {
      setTodos(prev => [data as Todo, ...prev])
    } else {
      fetchTodos()
    }
  }

  async function handleComplete(id: string) {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const now = new Date().toISOString()
    await supabase
      .from('user_todos')
      .update({ is_completed: true, completed_at: now, updated_at: now })
      .eq('id', id)
      .eq('user_id', session.user.id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  function isOverdue(dateStr: string | null) {
    if (!dateStr) return false
    return isBefore(parseISO(dateStr), startOfDay(new Date()))
  }

  if (loading) return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 flex items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Today's Tasks</span>
          {todos.length > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-300 flex items-center justify-center">
              {todos.length}
            </span>
          )}
        </div>
        <Link
          href="/todos"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
        >
          All tasks <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Quick add */}
      <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2">
        <Plus className="h-3.5 w-3.5 text-slate-600 shrink-0" />
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Quick add for today..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
        />
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500 shrink-0" />}
      </div>

      {/* Task list */}
      {todos.length === 0 ? (
        <p className="text-center text-xs text-slate-600 py-2">
          Nothing due today — add a task above
        </p>
      ) : (
        <ul className="space-y-1.5">
          {todos.map(todo => (
            <li key={todo.id} className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => handleComplete(todo.id)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-white/20 hover:border-violet-400 hover:bg-violet-500/20 transition-all"
              />
              <span className={cn(
                'text-sm flex-1',
                isOverdue(todo.due_date) ? 'text-red-300/80' : 'text-slate-200'
              )}>
                {todo.title}
                {isOverdue(todo.due_date) && (
                  <span className="ml-1.5 text-[10px] text-red-400/70">overdue</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
