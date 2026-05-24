'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus, X, Utensils, Dumbbell, CheckSquare, CreditCard, BookOpen,
  Loader2, Check, Camera, Image as ImageIcon, Zap, Sparkles, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import RichTextEditor from './RichTextEditor'

type Panel = 'meal' | 'workout' | 'habit' | 'finance' | 'journal'
type MealType    = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type WorkoutType = 'cardio' | 'strength' | 'yoga' | 'sports' | 'rest'
type TxnType     = 'expense' | 'income' | 'savings'

interface Habit {
  id: string
  habit_name: string
  category: 'mindset' | 'social' | 'productivity'
  streak_count: number
  longest_streak: number
  last_done_at: string | null
  frequency: 'daily' | 'weekly'
  is_keystone: boolean
}

// ─── Utils ────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function computeStreak(current: number, lastDoneAt: string | null, freq: 'daily' | 'weekly'): number {
  if (!lastDoneAt) return 1
  const last  = new Date(lastDoneAt); last.setHours(0, 0, 0, 0)
  const today = new Date();           today.setHours(0, 0, 0, 0)
  const diff  = Math.round((today.getTime() - last.getTime()) / 86400000)
  if (freq === 'daily') {
    if (diff === 0) return current
    if (diff === 1) return current + 1
    return 1
  }
  if (diff === 0) return current
  if (diff <= 7)  return current + 1
  return 1
}

// ─── Image resize (prevents 413 on large phone photos) ───────────

async function resizeImage(dataUrl: string, maxPx = 1024, quality = 0.82): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = reject
    img.onload = () => {
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const out = canvas.toDataURL('image/jpeg', quality)
      resolve({ base64: out.split(',')[1], mediaType: 'image/jpeg' })
    }
    img.src = dataUrl
  })
}

interface NutritionEstimate {
  food_name: string; calories: number
  protein_g: number; carbs_g: number; fiber_g: number; fat_g: number
  notes: string
}

// ─── Meal Panel ───────────────────────────────────────────────────

const MEAL_TYPES: { value: MealType; icon: string; label: string }[] = [
  { value: 'breakfast', icon: '🌅', label: 'Breakfast' },
  { value: 'lunch',     icon: '☀️', label: 'Lunch'     },
  { value: 'dinner',    icon: '🌙', label: 'Dinner'    },
  { value: 'snack',     icon: '🍎', label: 'Snack'     },
]

function MealPanel({ onDone }: { onDone: () => void }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const [mealType, setMealType]       = useState<MealType>(() => {
    const h = new Date().getHours()
    return h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 20 ? 'dinner' : 'snack'
  })
  const [preview, setPreview]         = useState<string | null>(null)
  const [analyzing, setAnalyzing]     = useState(false)
  const [analyzeErr, setAnalyzeErr]   = useState<string | null>(null)
  const [aiReady, setAiReady]         = useState(false)
  const [autofilling, setAutofilling] = useState(false)
  const [autofillErr, setAutofillErr] = useState<string | null>(null)
  const [foodName, setFoodName]       = useState('')
  const [calories, setCalories]       = useState('')
  const [macros, setMacros]           = useState({ protein_g: 0, carbs_g: 0, fiber_g: 0, fat_g: 0 })
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      setPreview(e.target?.result as string)
      setAiReady(false); setAnalyzeErr(null)
    }
    reader.readAsDataURL(file)
  }

  function fillFromEstimate(r: NutritionEstimate) {
    setFoodName(r.food_name)
    setCalories(String(r.calories))
    setMacros({ protein_g: r.protein_g, carbs_g: r.carbs_g, fiber_g: r.fiber_g, fat_g: r.fat_g })
    setAiReady(true)
  }

  async function analyze() {
    if (!preview) return
    setAnalyzing(true); setAnalyzeErr(null)
    try {
      const { base64, mediaType } = await resizeImage(preview)
      const res  = await fetch('/api/nutrition/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      const text = await res.text()
      let data: NutritionEstimate
      try { data = JSON.parse(text) } catch { throw new Error(res.ok ? 'Unexpected response' : `Server error ${res.status}`) }
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Analysis failed')
      fillFromEstimate(data)
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : 'Analysis failed')
    } finally { setAnalyzing(false) }
  }

  async function autofill() {
    if (!foodName.trim() || autofilling) return
    setAutofilling(true); setAutofillErr(null)
    try {
      const res  = await fetch('/api/nutrition/autofill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodName: foodName.trim() }),
      })
      const text = await res.text()
      let data: NutritionEstimate
      try { data = JSON.parse(text) } catch { throw new Error(res.ok ? 'Unexpected response' : `Server error ${res.status}`) }
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Autofill failed')
      fillFromEstimate(data)
    } catch (e) {
      setAutofillErr(e instanceof Error ? e.message : 'Autofill failed')
    } finally { setAutofilling(false) }
  }

  async function handleSave() {
    if (!foodName.trim() || !calories) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    await supabase.from('nutrition_logs').insert({
      user_id:   session.user.id,
      log_date:  todayStr(),
      meal_type: mealType,
      food_name: foodName.trim(),
      calories:  Math.round(Number(calories)),
      ...macros,
    })
    setSaving(false); setSaved(true)
    setTimeout(onDone, 900)
  }

  if (saved) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30">
        <Check className="h-6 w-6 text-amber-400" />
      </div>
      <p className="text-sm text-slate-300">Meal logged!</p>
    </div>
  )

  return (
    <div className="space-y-3.5">
      {/* Meal type */}
      <div className="grid grid-cols-4 gap-1.5">
        {MEAL_TYPES.map(t => (
          <button key={t.value} type="button" onClick={() => setMealType(t.value)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border py-2.5 px-1 text-xs font-medium transition-all',
              mealType === t.value
                ? 'border-amber-500 bg-amber-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
            )}>
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Photo zone */}
      {preview ? (
        <div className="relative rounded-xl overflow-hidden h-36 cursor-pointer group" onClick={() => fileRef.current?.click()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="food" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-white font-medium">Tap to replace</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/10 hover:border-amber-500/40 py-4 text-slate-500 hover:text-slate-300 transition-all">
            <Camera className="h-6 w-6" />
            <span className="text-xs font-medium">Take Photo</span>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/10 hover:border-amber-500/40 py-4 text-slate-500 hover:text-slate-300 transition-all">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs font-medium">Upload Photo</span>
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />

      {/* Analyze button */}
      {preview && !aiReady && (
        <button onClick={analyze} disabled={analyzing}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-amber-300 transition-all">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {analyzing ? 'Analysing…' : 'Analyse with AI'}
        </button>
      )}

      {analyzeErr && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{analyzeErr}
        </div>
      )}

      {aiReady && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> AI estimate ready — adjust if needed
        </div>
      )}

      {/* Food name + autofill */}
      <div className="flex gap-2">
        <input
          autoFocus
          placeholder="What did you eat?"
          value={foodName}
          onChange={e => { setFoodName(e.target.value); setAutofillErr(null) }}
          onKeyDown={e => { if (e.key === 'Enter' && foodName.trim().length >= 3) autofill() }}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
        />
        <button type="button" onClick={autofill} disabled={autofilling || !foodName.trim()}
          title="Auto-fill macros with AI"
          className={cn(
            'shrink-0 flex items-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
            autofilling
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : foodName.trim()
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                : 'border-white/10 bg-white/5 text-slate-600 cursor-not-allowed',
          )}>
          {autofilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        </button>
      </div>

      {autofillErr && (
        <p className="text-[11px] text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />{autofillErr}
        </p>
      )}

      {/* Calories */}
      <input
        type="number" min={0}
        placeholder="Calories (kcal)"
        value={calories}
        onChange={e => setCalories(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
      />

      <button
        onClick={handleSave}
        disabled={saving || !foodName.trim() || !calories}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Log Meal
      </button>
    </div>
  )
}

// ─── Workout Panel ────────────────────────────────────────────────

const WORKOUT_TYPES: { value: WorkoutType; icon: string; label: string }[] = [
  { value: 'cardio',   icon: '🏃', label: 'Cardio'   },
  { value: 'strength', icon: '💪', label: 'Strength' },
  { value: 'yoga',     icon: '🧘', label: 'Yoga'     },
  { value: 'sports',   icon: '⚽', label: 'Sports'   },
  { value: 'rest',     icon: '😴', label: 'Rest'     },
]

function WorkoutPanel({ onDone }: { onDone: () => void }) {
  const [workoutType, setWorkoutType] = useState<WorkoutType>('strength')
  const [duration, setDuration]       = useState('')
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  async function handleSave() {
    if (workoutType !== 'rest' && !duration) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    await supabase.from('workout_logs').insert({
      user_id:       session.user.id,
      log_date:      todayStr(),
      workout_type:  workoutType,
      duration_mins: Number(duration) || 0,
      exercises:     [],
      notes:         notes.trim() || null,
    })
    setSaving(false); setSaved(true)
    setTimeout(onDone, 900)
  }

  if (saved) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/20 border border-sky-500/30">
        <Check className="h-6 w-6 text-sky-400" />
      </div>
      <p className="text-sm text-slate-300">Workout logged!</p>
    </div>
  )

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-5 gap-1">
        {WORKOUT_TYPES.map(t => (
          <button key={t.value} type="button" onClick={() => setWorkoutType(t.value)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border py-2.5 px-1 text-xs font-medium transition-all',
              workoutType === t.value
                ? 'border-sky-500 bg-sky-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
            )}>
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {workoutType !== 'rest' && (
        <input
          autoFocus
          type="number" min={1}
          placeholder="Duration (minutes)"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
        />
      )}
      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-sky-500"
      />
      <button
        onClick={handleSave}
        disabled={saving || (workoutType !== 'rest' && !duration)}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Log Workout
      </button>
    </div>
  )
}

// ─── Habit Panel ──────────────────────────────────────────────────

const CAT_BADGE: Record<string, string> = {
  mindset:      'bg-violet-500/20 text-violet-300',
  social:       'bg-sky-500/20 text-sky-300',
  productivity: 'bg-emerald-500/20 text-emerald-300',
}

function HabitPanel() {
  const [habits, setHabits]       = useState<Habit[]>([])
  const [doneIds, setDoneIds]     = useState<Set<string>>(new Set())
  const [loading, setLoading]     = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }
      setUserId(session.user.id)
      const today = todayStr()

      const [habitsRes, logsRes] = await Promise.all([
        supabase.from('personality_habits')
          .select('id, habit_name, category, streak_count, longest_streak, last_done_at, frequency, is_keystone')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true }),
        supabase.from('habit_logs')
          .select('habit_id')
          .eq('user_id', session.user.id)
          .eq('log_date', today)
          .eq('status', 'done'),
      ])

      const fetchedHabits = (habitsRes.data as Habit[]) ?? []
      setHabits(fetchedHabits)

      const done = new Set<string>()
      if (!logsRes.error && logsRes.data) {
        for (const row of logsRes.data as { habit_id: string }[]) done.add(row.habit_id)
      }
      // Fallback: check last_done_at for today
      for (const h of fetchedHabits) {
        if (h.last_done_at) {
          const d = new Date(h.last_done_at)
          const ds = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
          if (ds === today) done.add(h.id)
        }
      }
      setDoneIds(done)
      setLoading(false)
    }
    load()
  }, [])

  async function markDone(habit: Habit) {
    if (doneIds.has(habit.id) || !!markingId || !userId) return
    setMarkingId(habit.id)
    const newStreak = computeStreak(habit.streak_count, habit.last_done_at, habit.frequency)
    const now   = new Date().toISOString()
    const today = todayStr()

    setDoneIds(prev => { const s = new Set(prev); s.add(habit.id); return s })
    setHabits(prev => prev.map(h => h.id === habit.id
      ? { ...h, streak_count: newStreak, longest_streak: Math.max(newStreak, h.longest_streak), last_done_at: now }
      : h
    ))

    const supabase = createSupabaseBrowserClient()
    await Promise.all([
      supabase.from('personality_habits').update({
        streak_count:   newStreak,
        longest_streak: Math.max(newStreak, habit.longest_streak),
        last_done_at:   now,
        updated_at:     now,
      }).eq('id', habit.id),
      supabase.from('habit_logs').upsert(
        { user_id: userId, habit_id: habit.id, log_date: today, status: 'done' },
        { onConflict: 'habit_id,log_date' }
      ),
    ])
    setMarkingId(null)
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>

  if (habits.length === 0) return (
    <div className="text-center py-8 space-y-1">
      <p className="text-sm text-slate-400">No habits yet.</p>
      <p className="text-xs text-slate-600">Add habits in the Personality section.</p>
    </div>
  )

  const pending  = habits.filter(h => !doneIds.has(h.id))
  const doneList = habits.filter(h => doneIds.has(h.id))
  const allDone  = doneIds.size === habits.length

  return (
    <div className="space-y-3">
      <p className="text-xs text-center text-slate-500">
        {doneIds.size}/{habits.length} done today
        {allDone && ' 🎉'}
      </p>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {[...pending, ...doneList].map(habit => {
          const isDone = doneIds.has(habit.id)
          return (
            <button
              key={habit.id}
              onClick={() => markDone(habit)}
              disabled={isDone || !!markingId}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                isDone
                  ? 'border-emerald-500/20 bg-emerald-500/5 opacity-60 cursor-default'
                  : 'border-white/10 bg-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/8 active:scale-[0.98]',
              )}
            >
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                isDone ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600',
              )}>
                {markingId === habit.id
                  ? <Loader2 className="h-3 w-3 animate-spin text-white" />
                  : isDone
                    ? <Check className="h-3 w-3 text-white" />
                    : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', isDone ? 'text-slate-500 line-through' : 'text-white')}>
                  {habit.habit_name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full capitalize', CAT_BADGE[habit.category] ?? 'bg-white/10 text-slate-400')}>
                    {habit.category}
                  </span>
                  {habit.streak_count > 0 && !isDone && (
                    <span className="text-xs text-orange-400">🔥 {habit.streak_count}</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-600 text-center">Tap a habit to mark it done</p>
    </div>
  )
}

// ─── Finance Panel ────────────────────────────────────────────────

const CATS: Record<TxnType, string[]> = {
  expense: ['Food', 'Rent', 'Transport', 'Entertainment', 'Healthcare', 'Shopping', 'Utilities', 'Other'],
  income:  ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'],
  savings: ['Emergency Fund', 'Retirement', 'Goal', 'Other'],
}

const TXN_ICON: Record<TxnType, string> = { expense: '📤', income: '📥', savings: '🏦' }

function FinancePanel({ onDone }: { onDone: () => void }) {
  const [txnType, setTxnType]   = useState<TxnType>('expense')
  const [category, setCategory] = useState(CATS.expense[0])
  const [amount, setAmount]     = useState('')
  const [description, setDesc]  = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  function handleTypeChange(t: TxnType) { setTxnType(t); setCategory(CATS[t][0]) }

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    await supabase.from('transactions').insert({
      user_id:     session.user.id,
      txn_date:    todayStr(),
      type:        txnType,
      category,
      amount:      Number(amount),
      description: description.trim() || null,
    })
    setSaving(false); setSaved(true)
    setTimeout(onDone, 900)
  }

  if (saved) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30">
        <Check className="h-6 w-6 text-violet-400" />
      </div>
      <p className="text-sm text-slate-300">Transaction logged!</p>
    </div>
  )

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-3 gap-1.5">
        {(['expense', 'income', 'savings'] as TxnType[]).map(t => (
          <button key={t} type="button" onClick={() => handleTypeChange(t)}
            className={cn(
              'rounded-lg border py-2 text-xs font-medium capitalize transition-all',
              txnType === t
                ? 'border-violet-500 bg-violet-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
            )}>
            {TXN_ICON[t]} {t}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATS[txnType].map(c => (
          <button key={c} type="button" onClick={() => setCategory(c)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
              category === c
                ? 'border-violet-500 bg-violet-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
            )}>
            {c}
          </button>
        ))}
      </div>
      <input
        autoFocus
        type="number" min={0} step="0.01"
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
      />
      <input
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDesc(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
      />
      <button
        onClick={handleSave}
        disabled={saving || !amount || Number(amount) <= 0}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Log Transaction
      </button>
    </div>
  )
}

// ─── Journal Panel ────────────────────────────────────────────────

const MOOD_META = [
  { label: 'Rough', emoji: '😔' },
  { label: 'Low',   emoji: '😕' },
  { label: 'Okay',  emoji: '😐' },
  { label: 'Good',  emoji: '🙂' },
  { label: 'Great', emoji: '😊' },
] as const

function JournalPanel({ onDone }: { onDone: () => void }) {
  const [title, setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood]     = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('journal_entries').insert({
      title:      title.trim() || null,
      content:    content.trim(),
      mood,
      entry_date: todayStr(),
    })
    setSaving(false); setSaved(true)
    setTimeout(onDone, 900)
  }

  if (saved) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/30">
        <Check className="h-6 w-6 text-rose-400" />
      </div>
      <p className="text-sm text-slate-300">Entry saved!</p>
    </div>
  )

  return (
    <div className="space-y-3.5">
      {/* Mood picker */}
      <div className="flex gap-1.5 justify-between">
        {MOOD_META.map((m, i) => {
          const val = i + 1
          return (
            <button key={val} type="button" onClick={() => setMood(mood === val ? null : val)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium transition-all',
                mood === val
                  ? 'border-rose-500 bg-rose-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
              )}>
              <span className="text-lg">{m.emoji}</span>
              <span className="text-[10px]">{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Title */}
      <input
        placeholder="Title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
      />

      {/* Content */}
      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder="What's on your mind?"
      />

      <button
        onClick={handleSave}
        disabled={saving || !content.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Entry
      </button>
    </div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────

const TABS: {
  id: Panel; label: string; Icon: React.ElementType
  activeClass: string; inactiveClass: string
}[] = [
  {
    id: 'meal', label: 'Meal', Icon: Utensils,
    activeClass:   'border-amber-500 bg-amber-500/20 text-white',
    inactiveClass: 'border-amber-500/20 bg-amber-500/8 text-amber-400/80 hover:opacity-100',
  },
  {
    id: 'workout', label: 'Workout', Icon: Dumbbell,
    activeClass:   'border-sky-500 bg-sky-500/20 text-white',
    inactiveClass: 'border-sky-500/20 bg-sky-500/8 text-sky-400/80 hover:opacity-100',
  },
  {
    id: 'habit', label: 'Habits', Icon: CheckSquare,
    activeClass:   'border-emerald-500 bg-emerald-500/20 text-white',
    inactiveClass: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400/80 hover:opacity-100',
  },
  {
    id: 'finance', label: 'Finance', Icon: CreditCard,
    activeClass:   'border-violet-500 bg-violet-500/20 text-white',
    inactiveClass: 'border-violet-500/20 bg-violet-500/8 text-violet-400/80 hover:opacity-100',
  },
  {
    id: 'journal', label: 'Journal', Icon: BookOpen,
    activeClass:   'border-rose-500 bg-rose-500/20 text-white',
    inactiveClass: 'border-rose-500/20 bg-rose-500/8 text-rose-400/80 hover:opacity-100',
  },
]

// ─── Main export ──────────────────────────────────────────────────

export default function QuickLog() {
  const [open, setOpen]       = useState(false)
  const [panel, setPanel]     = useState<Panel>('meal')
  const [pinging, setPinging] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setPinging(false), 3000)
    return () => clearTimeout(t)
  }, [])

  function close() { setOpen(false) }
  function handleDone() { close() }

  return (
    <>
      {/* ── FAB ── */}
      <div className="fixed bottom-[4.75rem] left-4 z-40 sm:bottom-6 sm:left-6 md:left-[280px]">
        {pinging && <span className="absolute inset-0 rounded-full animate-ping bg-emerald-500/30 pointer-events-none" />}
        <button
          onClick={() => setOpen(true)}
          title="Quick Log"
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-sky-600 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* ── Modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[88vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 shrink-0">
              <p className="text-sm font-semibold text-white">Quick Log</p>
              <button onClick={close} className="text-slate-500 hover:text-white transition-colors p-1 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab strip */}
            <div className="flex gap-1.5 px-5 py-3 shrink-0">
              {TABS.map(({ id, label, Icon, activeClass, inactiveClass }) => (
                <button key={id} type="button" onClick={() => setPanel(id)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] font-medium transition-all',
                    panel === id ? activeClass : inactiveClass,
                  )}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0">
              {panel === 'meal'    && <MealPanel    onDone={handleDone} />}
              {panel === 'workout' && <WorkoutPanel onDone={handleDone} />}
              {panel === 'habit'   && <HabitPanel />}
              {panel === 'finance' && <FinancePanel onDone={handleDone} />}
              {panel === 'journal' && <JournalPanel onDone={handleDone} />}
            </div>

          </div>
        </div>
      )}
    </>
  )
}
