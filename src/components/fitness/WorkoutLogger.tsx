'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, Check, Dumbbell } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

type WorkoutType = 'cardio' | 'strength' | 'yoga' | 'sports' | 'rest'

interface Exercise {
  name: string
  sets: string
  reps: string
}

interface WorkoutLog {
  id: string
  log_date: string
  workout_type: WorkoutType
  duration_mins: number
  exercises: { name: string; sets: number; reps: string }[]
  notes: string | null
}

const WORKOUT_TYPES: { value: WorkoutType; label: string; icon: string }[] = [
  { value: 'cardio',   label: 'Cardio',   icon: '🏃' },
  { value: 'strength', label: 'Strength', icon: '💪' },
  { value: 'yoga',     label: 'Yoga',     icon: '🧘' },
  { value: 'sports',   label: 'Sports',   icon: '⚽' },
  { value: 'rest',     label: 'Rest',     icon: '😴' },
]

const TYPE_COLOR: Record<WorkoutType, string> = {
  cardio:   'bg-sky-500/20 text-sky-300',
  strength: 'bg-violet-500/20 text-violet-300',
  yoga:     'bg-teal-500/20 text-teal-300',
  sports:   'bg-orange-500/20 text-orange-300',
  rest:     'bg-slate-500/20 text-slate-400',
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function WorkoutLogger() {
  const [date, setDate]           = useState(todayStr())
  const [type, setType]           = useState<WorkoutType>('strength')
  const [duration, setDuration]   = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([{ name: '', sets: '', reps: '' }])
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  const fetchRecentLogs = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoadingLogs(false); return }
    const { data } = await supabase
      .from('workout_logs')
      .select('id, log_date, workout_type, duration_mins, exercises, notes')
      .eq('user_id', session.user.id)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentLogs((data as WorkoutLog[]) ?? [])
    setLoadingLogs(false)
  }, [])

  useEffect(() => { fetchRecentLogs() }, [fetchRecentLogs])

  function addExercise() {
    setExercises(prev => [...prev, { name: '', sets: '', reps: '' }])
  }

  function removeExercise(i: number) {
    setExercises(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateExercise(i: number, field: keyof Exercise, value: string) {
    setExercises(prev => prev.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex))
  }

  async function saveLog() {
    setSaving(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setError('Not signed in. Please refresh and try again.')
      setSaving(false)
      return
    }

    const cleanExercises = type === 'rest'
      ? []
      : exercises.filter(e => e.name.trim()).map(e => ({
          name: e.name.trim(),
          sets: Number(e.sets) || 0,
          reps: e.reps.trim() || '0',
        }))

    const { error: insertError } = await supabase.from('workout_logs').insert({
      user_id: session.user.id,
      log_date: date,
      workout_type: type,
      duration_mins: Number(duration) || 0,
      exercises: cleanExercises,
      notes: notes.trim() || null,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)

    // Reset form
    setType('strength')
    setDuration('')
    setExercises([{ name: '', sets: '', reps: '' }])
    setNotes('')
    setDate(todayStr())

    fetchRecentLogs()
  }

  const canSave = type === 'rest' || duration.trim() !== ''

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-white">Log Workout</h2>

      {/* Form */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
        {/* Date */}
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Date</Label>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Workout type */}
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Type</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {WORKOUT_TYPES.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border py-2.5 px-1 text-xs font-medium transition-all',
                  type === value
                    ? 'border-violet-500 bg-violet-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                )}
              >
                <span className="text-base">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        {type !== 'rest' && (
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Duration (minutes)</Label>
            <Input
              type="number"
              min="1"
              max="300"
              placeholder="e.g. 45"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>
        )}

        {/* Exercises */}
        {type === 'strength' && (
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs">Exercises</Label>
            {exercises.map((ex, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Exercise name"
                  value={ex.name}
                  onChange={(e) => updateExercise(i, 'name', e.target.value)}
                  className="flex-1 border-white/20 bg-white/5 text-white placeholder:text-slate-500 text-sm focus-visible:ring-violet-500"
                />
                <Input
                  placeholder="Sets"
                  type="number"
                  min="1"
                  value={ex.sets}
                  onChange={(e) => updateExercise(i, 'sets', e.target.value)}
                  className="w-16 border-white/20 bg-white/5 text-white placeholder:text-slate-500 text-sm focus-visible:ring-violet-500"
                />
                <Input
                  placeholder="Reps"
                  value={ex.reps}
                  onChange={(e) => updateExercise(i, 'reps', e.target.value)}
                  className="w-20 border-white/20 bg-white/5 text-white placeholder:text-slate-500 text-sm focus-visible:ring-violet-500"
                />
                {exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExercise(i)}
                    className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addExercise}
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add exercise
            </button>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Notes (optional)</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it go?"
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
        )}

        <Button
          onClick={saveLog}
          disabled={saving || !canSave}
          className={cn(
            'w-full',
            saved
              ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          )}
        >
          {saving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            : saved
              ? <><Check className="mr-2 h-4 w-4" /> Saved!</>
              : 'Save Workout'
          }
        </Button>
      </div>

      {/* Recent logs */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Workouts</h3>

        {loadingLogs ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : recentLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
            <Dumbbell className="h-8 w-8 text-violet-400/30 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No workouts logged yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => {
              const wt = WORKOUT_TYPES.find(w => w.value === log.workout_type)
              return (
                <div
                  key={log.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3"
                >
                  <span className="text-xl shrink-0">{wt?.icon ?? '🏋️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white capitalize">{log.workout_type}</p>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full', TYPE_COLOR[log.workout_type])}>
                        {log.duration_mins > 0 ? `${log.duration_mins} min` : 'Rest day'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {format(new Date(log.log_date + 'T12:00:00'), 'EEE, MMM d')}
                      {log.exercises?.length > 0 && ` · ${log.exercises.length} exercise${log.exercises.length === 1 ? '' : 's'}`}
                    </p>
                    {log.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{log.notes}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
