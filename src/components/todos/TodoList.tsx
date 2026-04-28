'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Check, Trash2, ChevronDown, ChevronUp,
  Loader2, StickyNote, Calendar, X,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import {
  format, isToday, isTomorrow, parseISO,
  isAfter, isBefore, addDays, startOfDay, endOfDay,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Todo {
  id: string
  title: string
  notes: string | null
  due_date: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

type Filter = 'today' | 'week' | 'all'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All' },
]

function formatDueDate(dateStr: string) {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'MMM d')
}

function dueDateStyle(dateStr: string) {
  const d = parseISO(dateStr)
  if (isBefore(d, startOfDay(new Date()))) return 'text-red-400 bg-red-500/10 border-red-500/20'
  if (isToday(d)) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  if (isTomorrow(d)) return 'text-sky-400 bg-sky-500/10 border-sky-500/20'
  return 'text-slate-400 bg-white/5 border-white/10'
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false
  return isBefore(parseISO(dateStr), startOfDay(new Date()))
}

export default function TodoList() {
  const [todos, setTodos]               = useState<Todo[]>([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState<Filter>('today')
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState(false)

  const [adding, setAdding]   = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate]   = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving]     = useState(false)

  const fetchTodos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { data } = await supabase
      .from('user_todos')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
    setTodos((data as Todo[]) ?? [])
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  function applyFilter(list: Todo[]) {
    const todayEnd = endOfDay(new Date())
    const weekEnd  = addDays(startOfDay(new Date()), 7)
    return list.filter(t => {
      if (t.is_completed) return false
      if (filter === 'today') {
        return !t.due_date || !isAfter(parseISO(t.due_date), todayEnd)
      }
      if (filter === 'week') {
        return !t.due_date || !isAfter(parseISO(t.due_date), weekEnd)
      }
      return true
    })
  }

  async function handleAdd() {
    if (!newTitle.trim() || saving) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const capturedDate = newDate

    const { data } = await supabase
      .from('user_todos')
      .insert({
        user_id:  user.id,
        title:    newTitle.trim(),
        notes:    newNotes.trim() || null,
        due_date: newDate || null,
      })
      .select()
      .single()

    setNewTitle('')
    setNewDate('')
    setNewNotes('')
    setAdding(false)
    setSaving(false)

    if (data) {
      // Optimistic: insert returned the row, add it directly — no re-fetch needed.
      setTodos(prev => [data as Todo, ...prev])
      if (capturedDate) {
        const d = parseISO(capturedDate)
        if (isAfter(d, addDays(startOfDay(new Date()), 7))) setFilter('all')
        else if (isAfter(d, endOfDay(new Date()))) setFilter('week')
      }
    } else {
      // SELECT after INSERT returned nothing (RLS gap or transient error) — reload from DB.
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
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, is_completed: true, completed_at: now } : t
    ))
  }

  async function handleUncomplete(id: string) {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const now = new Date().toISOString()
    await supabase
      .from('user_todos')
      .update({ is_completed: false, completed_at: null, updated_at: now })
      .eq('id', id)
      .eq('user_id', session.user.id)
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, is_completed: false, completed_at: null } : t
    ))
  }

  async function handleDelete(id: string) {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await supabase.from('user_todos').delete().eq('id', id).eq('user_id', session.user.id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  function toggleNotes(id: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered  = applyFilter(todos)
  const completed = todos.filter(t => t.is_completed)

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex-1 rounded-lg py-2 text-center text-sm font-medium transition-all',
              filter === f.key ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/3 px-4 py-3 text-sm text-slate-500 hover:text-white hover:border-violet-500/30 transition-all"
        >
          <Plus className="h-4 w-4" /> Add task
        </button>
      ) : (
        <div className="rounded-xl border border-violet-500/20 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Task title..."
              autoFocus
              className="flex-1 bg-transparent text-white placeholder:text-slate-600 text-sm focus:outline-none"
            />
            <button type="button" onClick={() => setAdding(false)} className="text-slate-600 hover:text-slate-400">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 border-t border-white/5 pt-2.5">
            <Calendar className="h-3.5 w-3.5 text-slate-600 shrink-0" />
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="bg-transparent text-slate-400 text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-start gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
            <textarea
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="Notes (optional)..."
              rows={2}
              className="flex-1 bg-transparent text-slate-400 placeholder:text-slate-700 text-xs resize-none focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleAdd}
              disabled={saving || !newTitle.trim()}
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white h-8 px-4"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAdding(false); setNewTitle(''); setNewDate(''); setNewNotes('') }}
              className="border-white/10 bg-transparent text-slate-400 hover:text-white h-8 px-4"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Todo list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/2 py-12 text-center">
          <p className="text-slate-500 text-sm">
            {filter === 'today' ? 'Nothing due today — great job! 🎉' : 'No tasks here yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(todo => (
            <div
              key={todo.id}
              className={cn(
                'rounded-xl border bg-white/3 px-4 py-3 transition-all',
                isOverdue(todo.due_date) ? 'border-red-500/20' : 'border-white/8'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Complete button */}
                <button
                  type="button"
                  onClick={() => handleComplete(todo.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-white/20 hover:border-violet-400 hover:bg-violet-500/20 transition-all"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white font-medium">{todo.title}</span>
                    {todo.due_date && (
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
                        dueDateStyle(todo.due_date)
                      )}>
                        {isOverdue(todo.due_date) ? '⚠ ' : ''}{formatDueDate(todo.due_date)}
                      </span>
                    )}
                  </div>

                  {todo.notes && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleNotes(todo.id)}
                        className="mt-1 flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
                      >
                        <StickyNote className="h-3 w-3" />
                        {expandedNotes.has(todo.id) ? 'Hide note' : 'View note'}
                        {expandedNotes.has(todo.id)
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {expandedNotes.has(todo.id) && (
                        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed border-l-2 border-white/10 pl-2.5">
                          {todo.notes}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(todo.id)}
                  className="text-slate-700 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed section */}
      {completed.length > 0 && (
        <div className="pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors mb-2"
          >
            {showCompleted ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {completed.length} completed
          </button>
          {showCompleted && (
            <div className="space-y-1.5">
              {completed.map(todo => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 px-4 py-2.5 opacity-50"
                >
                  <button
                    type="button"
                    onClick={() => handleUncomplete(todo.id)}
                    className="h-4 w-4 shrink-0 rounded-full bg-violet-500/30 flex items-center justify-center hover:bg-violet-500/50 transition-colors"
                  >
                    <Check className="h-2.5 w-2.5 text-violet-400" />
                  </button>
                  <span className="text-sm text-slate-400 line-through flex-1">{todo.title}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(todo.id)}
                    className="text-slate-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
