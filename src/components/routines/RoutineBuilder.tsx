'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Loader2, CheckCircle, GripVertical, ChevronUp, ChevronDown,
  Edit2, Check, X, Clock, Flame,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Step {
  id: string
  title: string
  duration_minutes: number
  position: number
}

interface Routine {
  id: string
  name: string
  type: 'morning' | 'evening' | 'custom'
  is_active: boolean
  steps: Step[]
  streak: number
  completedToday: boolean
}

const TYPE_CONFIG = {
  morning: { label: 'Morning', color: 'text-amber-400',  bg: 'bg-amber-500/15',  border: 'border-amber-500/25'  },
  evening: { label: 'Evening', color: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'border-indigo-500/25' },
  custom:  { label: 'Custom',  color: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/25' },
}

export default function RoutineBuilder() {
  const [routines, setRoutines]     = useState<Routine[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [newName, setNewName]       = useState('')
  const [newType, setNewType]       = useState<'morning'|'evening'|'custom'>('morning')
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null)
  const [runningId, setRunningId]   = useState<string | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Record<string, Set<string>>>({})
  const today = format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: rData } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at')

    const { data: sData } = await supabase
      .from('routine_steps')
      .select('*')
      .eq('user_id', user.id)
      .order('position')

    const { data: cData } = await supabase
      .from('routine_completions')
      .select('routine_id, completed_date, steps_completed')
      .eq('user_id', user.id)
      .order('completed_date', { ascending: false })
      .limit(100)

    const completionMap: Record<string, { dates: string[]; stepsToday: string[] }> = {}
    for (const c of cData ?? []) {
      if (!completionMap[c.routine_id]) completionMap[c.routine_id] = { dates: [], stepsToday: [] }
      completionMap[c.routine_id].dates.push(c.completed_date)
      if (c.completed_date === today) {
        completionMap[c.routine_id].stepsToday = (c.steps_completed as string[]) ?? []
      }
    }

    const stepMap: Record<string, Step[]> = {}
    for (const s of sData ?? []) {
      if (!stepMap[s.routine_id]) stepMap[s.routine_id] = []
      stepMap[s.routine_id].push(s as Step)
    }

    const initialChecked: Record<string, Set<string>> = {}
    const built: Routine[] = (rData ?? []).map(r => {
      const comp = completionMap[r.id]
      const streak = calcStreak(comp?.dates ?? [])
      const stepsToday = comp?.stepsToday ?? []
      initialChecked[r.id] = new Set(stepsToday)
      return {
        ...r,
        steps: stepMap[r.id] ?? [],
        streak,
        completedToday: stepsToday.length > 0 && stepsToday.length >= (stepMap[r.id]?.length ?? 0),
      }
    })

    setRoutines(built)
    setCheckedSteps(initialChecked)
    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  function calcStreak(dates: string[]): number {
    if (!dates.length) return 0
    const sorted = Array.from(new Set(dates)).sort().reverse()
    let streak = 0
    const checkDate = new Date()
    for (const d of sorted) {
      const expected = format(checkDate, 'yyyy-MM-dd')
      if (d === expected) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else if (d < expected) break
    }
    return streak
  }

  async function createRoutine() {
    if (!newName.trim()) return
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('routines').insert({
      user_id: user.id, name: newName.trim(), type: newType,
    })
    setNewName(''); setCreating(false)
    load()
  }

  async function addStep(routineId: string) {
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const routine = routines.find(r => r.id === routineId)
    const pos = (routine?.steps.length ?? 0)
    await supabase.from('routine_steps').insert({
      routine_id: routineId, user_id: user.id,
      title: 'New step', duration_minutes: 5, position: pos,
    })
    load()
  }

  async function updateStep(stepId: string, changes: Partial<Step>) {
    const supabase = createSupabaseBrowserClient()
    await supabase.from('routine_steps').update(changes).eq('id', stepId)
    load()
  }

  async function deleteStep(stepId: string) {
    const supabase = createSupabaseBrowserClient()
    await supabase.from('routine_steps').delete().eq('id', stepId)
    load()
  }

  async function deleteRoutine(routineId: string) {
    const supabase = createSupabaseBrowserClient()
    await supabase.from('routines').update({ is_active: false }).eq('id', routineId)
    load()
  }

  async function toggleStep(routineId: string, stepId: string) {
    const routine = routines.find(r => r.id === routineId)
    if (!routine) return

    const current = new Set(checkedSteps[routineId] ?? [])
    if (current.has(stepId)) current.delete(stepId)
    else current.add(stepId)

    setCheckedSteps(prev => ({ ...prev, [routineId]: current }))

    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const stepsArr = Array.from(current)
    await supabase.from('routine_completions').upsert({
      user_id: user.id,
      routine_id: routineId,
      completed_date: today,
      steps_completed: stepsArr,
    }, { onConflict: 'user_id,routine_id,completed_date' })

    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Existing routines */}
      {routines.map(routine => {
        const cfg = TYPE_CONFIG[routine.type]
        const checked = checkedSteps[routine.id] ?? new Set()
        const totalTime = routine.steps.reduce((s, st) => s + st.duration_minutes, 0)
        const isExpanded = activeRoutineId === routine.id
        const allDone = routine.steps.length > 0 && checked.size >= routine.steps.length

        return (
          <div key={routine.id} className={cn('rounded-2xl border', cfg.border, cfg.bg)}>
            {/* Header */}
            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setActiveRoutineId(isExpanded ? null : routine.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn('text-sm font-semibold', allDone ? 'text-white' : cfg.color)}>{routine.name}</p>
                  {allDone && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-xs', cfg.color)}>{cfg.label}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-xs text-slate-500">{routine.steps.length} steps · {totalTime}min</span>
                  {routine.streak > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-orange-400">
                      <Flame className="h-3 w-3" />{routine.streak}d
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {runningId === routine.id
                  ? <ChevronUp className="h-4 w-4 text-slate-500" />
                  : <ChevronDown className="h-4 w-4 text-slate-500" />
                }
              </div>
            </div>

            {/* Steps */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                {routine.steps.map(step => (
                  <StepRow
                    key={step.id}
                    step={step}
                    checked={checked.has(step.id)}
                    onToggle={() => toggleStep(routine.id, step.id)}
                    onUpdate={changes => updateStep(step.id, changes)}
                    onDelete={() => deleteStep(step.id)}
                  />
                ))}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => addStep(routine.id)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add step
                  </button>
                  <button
                    onClick={() => deleteRoutine(routine.id)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-slate-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Delete routine
                  </button>
                </div>

                {/* Progress */}
                {routine.steps.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{checked.size}/{routine.steps.length} steps</span>
                      <span>{Math.round(checked.size / routine.steps.length * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${routine.steps.length ? checked.size / routine.steps.length * 100 : 0}%`,
                          background: allDone ? '#22c55e' : '#7c3aed',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Create new */}
      {creating ? (
        <div className="rounded-2xl border border-white/10 bg-white/3 p-4 space-y-3">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createRoutine(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Routine name (e.g. Morning Power Hour)"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="flex gap-2">
            {(['morning', 'evening', 'custom'] as const).map(t => (
              <button key={t} onClick={() => setNewType(t)}
                className={cn(
                  'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all',
                  newType === t
                    ? 'border-violet-500 bg-violet-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                )}
              >
                {TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-slate-400 hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={createRoutine} disabled={!newName.trim()} className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 py-2 text-xs font-medium text-white transition-colors">Create</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500 hover:text-violet-400 hover:border-violet-500/30 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Create new routine
        </button>
      )}
    </div>
  )
}

function StepRow({
  step, checked, onToggle, onUpdate, onDelete,
}: {
  step: Step
  checked: boolean
  onToggle: () => void
  onUpdate: (c: Partial<Step>) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle]     = useState(step.title)
  const [dur, setDur]         = useState(step.duration_minutes)

  function save() {
    onUpdate({ title: title.trim() || step.title, duration_minutes: dur })
    setEditing(false)
  }

  return (
    <div className={cn(
      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all',
      checked ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/8 bg-white/3'
    )}>
      <button
        onClick={onToggle}
        className={cn(
          'shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
          checked ? 'border-emerald-500 bg-emerald-500' : 'border-white/20 hover:border-white/40'
        )}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </button>

      {editing ? (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 min-w-0 bg-transparent text-xs text-white focus:outline-none border-b border-violet-500/50"
          />
          <input
            type="number" min={1} max={120}
            value={dur}
            onChange={e => setDur(Number(e.target.value))}
            className="w-12 bg-transparent text-xs text-slate-400 focus:outline-none text-right"
          />
          <span className="text-xs text-slate-600">min</span>
          <button onClick={save} className="text-emerald-400 hover:text-emerald-300"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={() => setEditing(false)} className="text-slate-600 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={cn('flex-1 text-xs font-medium truncate', checked ? 'text-slate-500 line-through' : 'text-white')}>
            {step.title}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-slate-600 shrink-0">
            <Clock className="h-3 w-3" />{step.duration_minutes}m
          </span>
          <button onClick={() => { setTitle(step.title); setDur(step.duration_minutes); setEditing(true) }}
            className="shrink-0 text-slate-700 hover:text-slate-300 transition-colors">
            <Edit2 className="h-3 w-3" />
          </button>
          <button onClick={onDelete} className="shrink-0 text-slate-700 hover:text-red-400 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
