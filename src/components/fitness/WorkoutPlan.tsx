'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Sparkles, Dumbbell, RefreshCw } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

type WorkoutType = 'strength' | 'cardio' | 'yoga' | 'sports' | 'rest'

interface DayPlan {
  name: string
  type: WorkoutType
  duration_mins: number
  exercises: { name: string; sets: number; reps: string }[]
}

interface WeekPlan {
  monday: DayPlan
  tuesday: DayPlan
  wednesday: DayPlan
  thursday: DayPlan
  friday: DayPlan
  saturday: DayPlan
  sunday: DayPlan
  [key: string]: DayPlan
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const TYPE_STYLES: Record<WorkoutType, { badge: string; label: string }> = {
  strength: { badge: 'bg-violet-500/20 text-violet-300',  label: '💪 Strength' },
  cardio:   { badge: 'bg-sky-500/20 text-sky-300',        label: '🏃 Cardio' },
  yoga:     { badge: 'bg-teal-500/20 text-teal-300',      label: '🧘 Yoga' },
  sports:   { badge: 'bg-orange-500/20 text-orange-300',  label: '⚽ Sports' },
  rest:     { badge: 'bg-slate-500/20 text-slate-400',    label: '😴 Rest' },
}

function DayCard({ day, plan }: { day: string; plan: DayPlan }) {
  const [open, setOpen] = useState(false)
  const styles = TYPE_STYLES[plan.type] ?? TYPE_STYLES.rest
  const isToday = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] === day

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      isToday ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/10 bg-white/5'
    )}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-12 shrink-0">
                {day.slice(0, 3)}
              </span>
              {isToday && (
                <span className="text-xs bg-violet-500/30 text-violet-300 px-1.5 py-0.5 rounded-full">Today</span>
              )}
            </div>
            <p className="text-sm font-medium text-white truncate">{plan.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {plan.duration_mins > 0 && (
              <span className="text-xs text-slate-500">{plan.duration_mins}m</span>
            )}
            <span className={cn('text-xs px-2 py-0.5 rounded-full', styles.badge)}>
              {styles.label}
            </span>
          </div>
        </div>
      </button>

      {open && plan.exercises.length > 0 && (
        <div className="px-4 pb-3 border-t border-white/5 pt-2 space-y-1">
          {plan.exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{ex.name}</span>
              <span className="text-slate-500">{ex.sets} × {ex.reps}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WorkoutPlan() {
  const [plan, setPlan] = useState<WeekPlan | null>(null)
  const [planDate, setPlanDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchPlan = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const { data } = await supabase
      .from('workout_plans')
      .select('plan, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setPlan(data.plan as WeekPlan)
      setPlanDate(data.created_at)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  async function generatePlan() {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/fitness-plan', { method: 'POST' })
      const data = await res.json()
      if (data.plan) {
        setPlan(data.plan)
        fetchPlan()
      }
    } finally {
      setGenerating(false)
    }
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
          <h2 className="font-semibold text-white">Weekly Plan</h2>
          {planDate && (
            <p className="text-xs text-slate-500 mt-0.5">
              Generated {format(new Date(planDate), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={generatePlan}
          disabled={generating}
          className={cn(
            'gap-1.5',
            plan
              ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          )}
          variant={plan ? 'outline' : 'default'}
        >
          {generating
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            : plan
              ? <><RefreshCw className="h-4 w-4" /> Regenerate</>
              : <><Sparkles className="h-4 w-4" /> Generate Plan</>
          }
        </Button>
      </div>

      {!plan ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Dumbbell className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No plan yet.</p>
          <p className="text-slate-600 text-xs mt-1">
            Generate a personalised plan based on your fitness profile.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {DAYS.map((day) => (
            <DayCard key={day} day={day} plan={plan[day]} />
          ))}
        </div>
      )}
    </div>
  )
}
