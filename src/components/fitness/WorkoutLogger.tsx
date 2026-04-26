'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Check } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type WorkoutType = 'cardio' | 'strength' | 'yoga' | 'sports' | 'rest'

interface Exercise {
  name: string
  sets: string
  reps: string
}

const WORKOUT_TYPES: { value: WorkoutType; label: string; icon: string }[] = [
  { value: 'cardio',    label: 'Cardio',    icon: '🏃' },
  { value: 'strength',  label: 'Strength',  icon: '💪' },
  { value: 'yoga',      label: 'Yoga',      icon: '🧘' },
  { value: 'sports',    label: 'Sports',    icon: '⚽' },
  { value: 'rest',      label: 'Rest',      icon: '😴' },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function WorkoutLogger() {
  const [date, setDate]             = useState(todayStr())
  const [type, setType]             = useState<WorkoutType>('strength')
  const [duration, setDuration]     = useState('')
  const [exercises, setExercises]   = useState<Exercise[]>([{ name: '', sets: '', reps: '' }])
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const supabase = createSupabaseBrowserClient()

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
    const cleanExercises = type === 'rest'
      ? []
      : exercises.filter(e => e.name.trim()).map(e => ({
          name: e.name.trim(),
          sets: Number(e.sets) || 0,
          reps: e.reps.trim() || '0',
        }))

    await supabase.from('workout_logs').insert({
      log_date: date,
      workout_type: type,
      duration_mins: Number(duration) || 0,
      exercises: cleanExercises,
      notes: notes.trim() || null,
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)

    // Reset form
    setType('strength')
    setDuration('')
    setExercises([{ name: '', sets: '', reps: '' }])
    setNotes('')
    setDate(todayStr())
  }

  const canSave = type === 'rest' || duration.trim() !== ''

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-white">Log Workout</h2>

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
    </div>
  )
}
