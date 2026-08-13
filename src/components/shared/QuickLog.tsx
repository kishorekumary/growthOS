'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Utensils, Dumbbell, CheckSquare, CreditCard, BookOpen,
  Loader2, Check, Camera, Image as ImageIcon, Zap, Sparkles, AlertCircle, CheckCircle2,
  Mic, MicOff, RefreshCw, ClipboardList, Moon,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { useDraggableFab } from '@/hooks/useDraggableFab'
import { useHabitCelebration } from '@/hooks/useHabitCelebration'
import { HabitCategory, HABIT_CATEGORY_META } from '@/lib/habitCategories'
import { cn } from '@/lib/utils'
import { computeStreak, todayStr, yesterdayStr, isGraceActive } from '@/lib/habitStreak'
import { completeHabit } from '@/lib/completeHabit'
import { useReward } from '@/contexts/RewardContext'
import RichTextEditor from './RichTextEditor'

type Panel = 'voice' | 'meal' | 'workout' | 'habit' | 'finance' | 'journal' | 'task' | 'sleep'
type MealType    = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink'
type WorkoutType = 'cardio' | 'strength' | 'yoga' | 'sports' | 'rest'
type TxnType     = 'expense' | 'income' | 'savings'

interface Habit {
  id: string
  habit_name: string
  category: HabitCategory
  streak_count: number
  longest_streak: number
  last_done_at: string | null
  frequency: 'daily' | 'weekly'
  is_keystone: boolean
  is_global: boolean
}

interface HiddenMark {
  habit_id: string
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
  { value: 'drink',     icon: '☕', label: 'Drink'     },
]

const WATER_QUICK = [
  { icon: '☕', ml: 30,   label: '+30' },
  { icon: '🍵', ml: 150,  label: '+150' },
  { icon: '🥤', ml: 250,  label: '+250' },
  { icon: '🫗', ml: 500,  label: '+500' },
  { icon: '💧', ml: 1000, label: '+1L'  },
]

function MealPanel({ onDone }: { onDone: () => void }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const [mealType, setMealType]       = useState<MealType>(() => {
    const h = new Date().getHours()
    return h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 20 ? 'dinner' : h < 22 ? 'snack' : 'drink'
  })
  const [loggedTime, setLoggedTime]   = useState(() => {
    const n = new Date()
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
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
  const [waterAdded, setWaterAdded]   = useState(0)
  const [addingWater, setAddingWater] = useState<number | null>(null)
  const [userId, setUserId]           = useState<string | null>(null)

  useEffect(() => {
    createSupabaseBrowserClient().auth.getSession()
      .then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => { setPreview(e.target?.result as string); setAiReady(false); setAnalyzeErr(null) }
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
      const res  = await fetch('/api/nutrition/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mediaType }) })
      const text = await res.text()
      let data: NutritionEstimate
      try { data = JSON.parse(text) } catch { throw new Error(res.ok ? 'Unexpected response' : `Server error ${res.status}`) }
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Analysis failed')
      fillFromEstimate(data)
    } catch (e) { setAnalyzeErr(e instanceof Error ? e.message : 'Analysis failed') }
    finally { setAnalyzing(false) }
  }

  async function autofill() {
    if (!foodName.trim() || autofilling) return
    setAutofilling(true); setAutofillErr(null)
    try {
      const res  = await fetch('/api/nutrition/autofill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foodName: foodName.trim() }) })
      const text = await res.text()
      let data: NutritionEstimate
      try { data = JSON.parse(text) } catch { throw new Error(res.ok ? 'Unexpected response' : `Server error ${res.status}`) }
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Autofill failed')
      fillFromEstimate(data)
    } catch (e) { setAutofillErr(e instanceof Error ? e.message : 'Autofill failed') }
    finally { setAutofilling(false) }
  }

  async function handleSave() {
    if (!foodName.trim() || !calories) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    const [hh, mm] = loggedTime.split(':').map(Number)
    const ts = new Date(); ts.setHours(hh, mm, 0, 0)
    await supabase.from('nutrition_logs').insert({
      user_id:   session.user.id,
      log_date:  todayStr(),
      meal_type: mealType,
      food_name: foodName.trim(),
      calories:  Math.round(Number(calories)),
      logged_at: ts.toISOString(),
      ...macros,
    })
    setSaving(false); setSaved(true)
    setTimeout(onDone, 900)
  }

  async function addWater(ml: number) {
    if (!userId) return
    setAddingWater(ml)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('water_logs').insert({ user_id: userId, log_date: todayStr(), amount_ml: ml, logged_at: new Date().toISOString() })
    setWaterAdded(w => w + ml)
    setAddingWater(null)
  }

  if (saved) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30">
        <Check className="h-6 w-6 text-amber-400" />
      </div>
      <p className="text-sm text-slate-300">Logged!</p>
    </div>
  )

  return (
    <div className="space-y-3.5">
      {/* Time + meal type row */}
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={loggedTime}
          onChange={e => setLoggedTime(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 tabular-nums shrink-0"
        />
        <div className="flex gap-1 overflow-x-auto">
          {MEAL_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => setMealType(t.value)}
              className={cn(
                'shrink-0 flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all',
                mealType === t.value
                  ? 'border-amber-500 bg-amber-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
              )}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Photo zone */}
      {preview ? (
        <div className="relative rounded-xl overflow-hidden h-32 cursor-pointer group" onClick={() => fileRef.current?.click()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="food" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-white font-medium">Tap to replace</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/10 hover:border-amber-500/40 py-3.5 text-slate-500 hover:text-slate-300 transition-all">
            <Camera className="h-5 w-5" /><span className="text-xs font-medium">Take Photo</span>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/10 hover:border-amber-500/40 py-3.5 text-slate-500 hover:text-slate-300 transition-all">
            <ImageIcon className="h-5 w-5" /><span className="text-xs font-medium">Upload Photo</span>
          </button>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />
      <input ref={fileRef}   type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />

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

      {/* Food name + autofill (auto-triggers on Enter) */}
      <div className="flex gap-2">
        <input
          autoFocus
          placeholder={mealType === 'drink' ? 'What did you drink?' : 'What did you eat?'}
          value={foodName}
          onChange={e => { setFoodName(e.target.value); setAutofillErr(null); setAiReady(false) }}
          onKeyDown={e => { if (e.key === 'Enter' && foodName.trim().length >= 3) autofill() }}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
        />
        <button type="button" onClick={autofill} disabled={autofilling || !foodName.trim()}
          title="Auto-fill macros with AI (or press Enter)"
          className={cn(
            'shrink-0 flex items-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
            autofilling ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : foodName.trim() ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              : 'border-white/10 bg-white/5 text-slate-600 cursor-not-allowed',
          )}>
          {autofilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        </button>
      </div>
      {autofillErr && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{autofillErr}</p>}

      {/* Macros grid — shown after autofill */}
      {aiReady && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> AI estimate ready — adjust if needed
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'kcal',    value: calories,              color: 'text-amber-300',  isStr: true, onChange: setCalories },
              { label: 'protein', value: String(macros.protein_g), color: 'text-sky-300',  isStr: false, onChange: (v: string) => setMacros(m => ({ ...m, protein_g: Number(v) })) },
              { label: 'carbs',   value: String(macros.carbs_g),   color: 'text-violet-300',isStr: false, onChange: (v: string) => setMacros(m => ({ ...m, carbs_g: Number(v) })) },
              { label: 'fat',     value: String(macros.fat_g),     color: 'text-orange-300',isStr: false, onChange: (v: string) => setMacros(m => ({ ...m, fat_g: Number(v) })) },
            ].map(({ label, value, color, onChange }) => (
              <div key={label} className="flex flex-col items-center rounded-lg bg-black/20 py-1.5 px-1">
                <input
                  type="number" min={0}
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className={cn('w-full bg-transparent text-center text-sm font-bold focus:outline-none tabular-nums', color)}
                />
                <span className="text-[10px] text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calories field when no autofill yet */}
      {!aiReady && (
        <input type="number" min={0} placeholder="Calories (kcal)" value={calories}
          onChange={e => setCalories(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
        />
      )}

      <button onClick={handleSave} disabled={saving || !foodName.trim() || !calories}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-all">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Log Intake
      </button>

      {/* Water quick-log */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-sky-300">💧 Log Water</p>
          {waterAdded > 0 && <span className="text-xs text-sky-400 tabular-nums">+{waterAdded}ml added</span>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {WATER_QUICK.map(w => (
            <button key={w.ml} onClick={() => addWater(w.ml)} disabled={!userId || !!addingWater}
              className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-50 px-2 py-1 text-xs font-medium text-sky-300 transition-all">
              {addingWater === w.ml ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{w.icon}</span>}
              {w.label}
            </button>
          ))}
        </div>
      </div>
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

// ─── Sleep Panel ──────────────────────────────────────────────────

const SLEEP_QUALITY_LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Perfect']

function sleepHours(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)
  let mins = (wh * 60 + wm) - (bh * 60 + bm)
  if (mins < 0) mins += 24 * 60
  return Math.round((mins / 60) * 10) / 10
}

function SleepPanel({ onDone }: { onDone: () => void }) {
  const [bedtime, setBedtime]   = useState('22:30')
  const [wakeTime, setWakeTime] = useState('06:30')
  const [quality, setQuality]   = useState(0)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('sleep_logs').upsert({
      user_id:    user.id,
      sleep_date: todayStr(),
      bedtime,
      wake_time:  wakeTime,
      quality:    quality || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,sleep_date' })
    setSaving(false); setSaved(true)
    setTimeout(onDone, 900)
  }

  if (saved) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/30">
        <Check className="h-6 w-6 text-indigo-400" />
      </div>
      <p className="text-sm text-slate-300">Sleep logged!</p>
    </div>
  )

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-xs text-slate-500">Bedtime</label>
          <input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-500">Wake time</label>
          <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
        </div>
      </div>

      {bedtime && wakeTime && (
        <p className="text-xs text-indigo-300 font-medium">
          ≈ {sleepHours(bedtime, wakeTime)} hours of sleep
        </p>
      )}

      <div className="flex gap-1.5">
        {SLEEP_QUALITY_LABELS.map((label, i) => {
          const n = i + 1
          return (
            <button key={n} type="button" onClick={() => setQuality(quality === n ? 0 : n)}
              className={cn(
                'flex-1 h-9 rounded-lg border text-xs font-medium transition-all',
                quality === n
                  ? 'border-indigo-500 bg-indigo-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
              )}>
              {label}
            </button>
          )
        })}
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-all">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Log Sleep
      </button>
    </div>
  )
}

// ─── Habit Panel ──────────────────────────────────────────────────

const CAT_BADGE: Record<string, string> = Object.fromEntries(
  Object.entries(HABIT_CATEGORY_META).map(([key, meta]) => [key, meta.badge])
)

function HabitPanel() {
  const today = todayStr()

  const { data: rawHabits, loading: habitsLoading, isOffline, setData: setHabits } = useCachedQuery<Habit[]>(
    'habits:quicklog',
    (supabase, userId) => supabase.from('personality_habits')
      .select('id, habit_name, category, streak_count, longest_streak, last_done_at, frequency, is_keystone, is_global')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    [],
  )

  // A habit row here can be one of the admin's own global habits (global rows
  // are owned by the creating admin's user_id, so `.eq('user_id', userId)`
  // above picks them up same as any personal habit) — respect the same
  // per-user hide state the Habit Tracker's "Manage Global" modal writes to,
  // so hiding a global habit there also removes it from Quick Log.
  const { data: hiddenHabitMarks } = useCachedQuery<HiddenMark[]>(
    'hidden-global-habits',
    (supabase, userId) => supabase
      .from('user_hidden_habits')
      .select('habit_id')
      .eq('user_id', userId),
    []
  )
  const hiddenHabitIds = useMemo(
    () => new Set(hiddenHabitMarks.map(h => h.habit_id)),
    [hiddenHabitMarks]
  )
  const habits = useMemo(
    () => rawHabits.filter(h => !h.is_global || !hiddenHabitIds.has(h.id)),
    [rawHabits, hiddenHabitIds]
  )

  const { data: logs, loading: logsLoading } = useCachedQuery<{ habit_id: string; status: string }[]>(
    `habit_logs:${today}`,
    (supabase, userId) => supabase.from('habit_logs')
      .select('habit_id, status')
      .eq('user_id', userId)
      .eq('log_date', today),
    [],
    [today]
  )

  const yesterday = yesterdayStr()
  const {
    data: yesterdayLogs, loading: yesterdayLogsLoading, isOffline: yesterdayLogsOffline, refetch: refetchYesterday,
  } = useCachedQuery<{ habit_id: string; status: string }[]>(
    `habit_logs:${yesterday}`,
    (supabase, userId) => supabase.from('habit_logs')
      .select('habit_id, status')
      .eq('user_id', userId)
      .eq('log_date', yesterday),
    [],
    [yesterday]
  )

  const [doneIds, setDoneIds]     = useState<Set<string>>(new Set())
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set())
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)
  const [catchUpId, setCatchUpId]     = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissedRaw] = useState(false)
  const { celebrate, celebrationNode } = useHabitCelebration()
  const { celebrateMilestones } = useReward()

  const loading = habitsLoading || logsLoading

  useEffect(() => {
    createSupabaseBrowserClient().auth.getSession()
      .then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    try { setBannerDismissedRaw(localStorage.getItem(`habit_grace_dismissed_${today}`) === '1') } catch {}
  }, [today])

  useEffect(() => {
    const done   = new Set<string>()
    const missed = new Set<string>()
    for (const row of logs) {
      if (row.status === 'done')   done.add(row.habit_id)
      if (row.status === 'missed') missed.add(row.habit_id)
    }
    // Fallback: check last_done_at for today
    for (const h of habits) {
      if (h.last_done_at) {
        const d = new Date(h.last_done_at)
        const ds = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
        if (ds === today) done.add(h.id)
      }
    }
    setDoneIds(done)
    setMissedIds(missed)
  }, [habits, logs, today])

  async function markDone(habit: Habit) {
    if (doneIds.has(habit.id) || !!markingId || !userId) return
    setMarkingId(habit.id)

    setDoneIds(prev => { const s = new Set(prev); s.add(habit.id); return s })

    try {
      const { streak_count, milestones } = await completeHabit(habit.id)
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: new Date().toISOString() }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      setDoneIds(prev => { const s = new Set(prev); s.delete(habit.id); return s })
    }
    setMarkingId(null)
  }

  function dismissBanner() {
    setBannerDismissedRaw(true)
    try { localStorage.setItem(`habit_grace_dismissed_${today}`, '1') } catch {}
  }

  async function markDoneForYesterday(habit: Habit) {
    if (catchUpId || !userId) return

    // Defense-in-depth: never roll last_done_at backwards. If the habit was
    // already completed today (or otherwise has a last_done_at on/after
    // yesterday), catching up "yesterday" would corrupt the streak — the UI
    // filter should already exclude this habit from the banner, but this
    // write is consequential enough to guard independently.
    const yesterdayMidnight = new Date()
    yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1)
    yesterdayMidnight.setHours(0, 0, 0, 0)
    if (habit.last_done_at) {
      const lastMidnight = new Date(habit.last_done_at)
      lastMidnight.setHours(0, 0, 0, 0)
      if (lastMidnight.getTime() >= yesterdayMidnight.getTime()) return
    }

    setCatchUpId(habit.id)

    try {
      const { streak_count, milestones } = await completeHabit(habit.id, 'yesterday')
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString() })() }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      // no local state to roll back — nothing was optimistically set before the call
    }
    refetchYesterday()
    setCatchUpId(null)
  }

  const graceOpen = isGraceActive() && !yesterdayLogsOffline && !yesterdayLogsLoading
  const catchableHabits = graceOpen
    ? habits.filter(h => h.frequency === 'daily' && !doneIds.has(h.id) && !yesterdayLogs.some(l => l.habit_id === h.id && l.status === 'done'))
    : []

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>

  if (habits.length === 0 && isOffline) return (
    <div className="text-center py-8 space-y-1">
      <p className="text-sm text-slate-400">Can&apos;t load — you&apos;re offline.</p>
    </div>
  )

  if (habits.length === 0) return (
    <div className="text-center py-8 space-y-1">
      <p className="text-sm text-slate-400">No habits yet.</p>
      <p className="text-xs text-slate-600">Add habits in the Personality section.</p>
    </div>
  )

  // Missed habits are hidden; only show pending and done
  const pending  = habits.filter(h => !doneIds.has(h.id) && !missedIds.has(h.id))
  const doneList = habits.filter(h => doneIds.has(h.id))
  const visible  = pending.length + doneList.length
  const allDone  = visible > 0 && pending.length === 0

  return (
    <div className="space-y-3">
      {celebrationNode}
      {catchableHabits.length > 0 && !bannerDismissed && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-amber-200">
              {catchableHabits.length} missed yesterday — grace ends 12 PM
            </p>
            <button onClick={dismissBanner} aria-label="Dismiss" className="text-amber-400/60 hover:text-amber-300 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {catchableHabits.map(habit => (
            <div key={habit.id} className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-300 truncate">{habit.habit_name}</span>
              <button
                onClick={() => markDoneForYesterday(habit)}
                disabled={catchUpId === habit.id}
                className="shrink-0 flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 px-2 py-1 text-[11px] font-medium text-white transition-colors disabled:opacity-50"
              >
                {catchUpId === habit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Mark done
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-center text-slate-500">
        {doneList.length}/{visible} done today
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
                'w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                isDone
                  ? 'border-emerald-500/20 bg-emerald-500/5 opacity-60 cursor-default'
                  : 'border-white/10 bg-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/8 active:scale-[0.98]',
              )}
            >
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all mt-0.5',
                isDone ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600',
              )}>
                {markingId === habit.id
                  ? <Loader2 className="h-3 w-3 animate-spin text-white" />
                  : isDone
                    ? <Check className="h-3 w-3 text-white" />
                    : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium line-clamp-2', isDone ? 'text-slate-500 line-through' : 'text-white')}>
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

// ─── Voice Panel ─────────────────────────────────────────────────

type VoiceState = 'idle' | 'listening' | 'parsing' | 'confirm' | 'saving' | 'done' | 'error' | 'unsupported'

type VoiceResult =
  | { type: 'transaction'; txn_type: 'expense' | 'income' | 'savings'; amount: number; category: string; description: string; summary: string }
  | { type: 'workout';     workout_type: string; duration_mins: number | null; notes: string; summary: string }
  | { type: 'meal';        meal_type: string; food_name: string; summary: string }
  | { type: 'habit';       habit_name: string; summary: string }
  | { type: 'journal';     title: string | null; content: string; summary: string }
  | { type: 'unknown';     summary: string }

const INTENT_META: Record<string, { label: string; color: string; bg: string }> = {
  transaction: { label: 'Finance',  color: 'text-violet-300', bg: 'border-violet-500/30 bg-violet-500/10' },
  workout:     { label: 'Workout',  color: 'text-sky-300',    bg: 'border-sky-500/30 bg-sky-500/10'       },
  meal:        { label: 'Meal',     color: 'text-amber-300',  bg: 'border-amber-500/30 bg-amber-500/10'   },
  habit:       { label: 'Habit',    color: 'text-emerald-300',bg: 'border-emerald-500/30 bg-emerald-500/10'},
  journal:     { label: 'Journal',  color: 'text-rose-300',   bg: 'border-rose-500/30 bg-rose-500/10'     },
  unknown:     { label: 'Unknown',  color: 'text-slate-400',  bg: 'border-white/10 bg-white/5'            },
}

function VoicePanel({ onDone }: { onDone: () => void }) {
  const [state, setState]         = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim]     = useState('')
  const [result, setResult]       = useState<VoiceResult | null>(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [matchedHabit, setMatchedHabit]   = useState<Habit | null>(null)
  const [nutritionData, setNutritionData] = useState<NutritionEstimate | null>(null)
  const [parsingMsg, setParsingMsg]       = useState('Understanding your command…')
  const { celebrate, celebrationNode } = useHabitCelebration()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks the next expected final-result index to prevent mobile Chrome from
  // re-appending already-committed finals when e.resultIndex is unreliable.
  const nextFinalIdx    = useRef(0)

  function getSR() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
  }

  // Check browser support on mount
  useEffect(() => { if (!getSR()) setState('unsupported') }, [])

  function startListening() {
    const SR = getSR()
    if (!SR) { setState('unsupported'); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR()
    r.continuous     = true   // keep recording through natural pauses
    r.interimResults = true
    r.lang           = 'en-IN'
    recognitionRef.current = r

    r.onstart  = () => setState('listening')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror  = (e: any) => {
      if (e.error === 'aborted') return
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      setErrorMsg(e.error === 'not-allowed' ? 'Microphone access denied.' : `Error: ${e.error}`)
      setState('error')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      // Any speech activity resets the 3-second silence countdown
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

      let final = ''; let inter = ''
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          // Only append finals we haven't committed yet — guards against
          // mobile Chrome re-sending already-finalized results.
          if (i >= nextFinalIdx.current) {
            final += t
            nextFinalIdx.current = i + 1
          }
        } else {
          inter += t
        }
      }
      if (final) setTranscript(p => (p + ' ' + final).trim())
      setInterim(inter)

      // Auto-stop 3 seconds after the last detected word
      silenceTimerRef.current = setTimeout(() => {
        recognitionRef.current?.stop()
      }, 3000)
    }
    r.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      setInterim('')
      setTranscript(p => p.trim())
      setState(prev => prev === 'listening' ? 'parsing' : prev)
    }

    setTranscript('')
    setInterim('')
    setResult(null)
    setNutritionData(null)
    nextFinalIdx.current = 0
    r.start()
  }

  function stopListening() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    recognitionRef.current?.stop()
  }

  // Trigger parse when state becomes 'parsing'
  useEffect(() => {
    if (state !== 'parsing') return
    if (!transcript.trim()) { setState('idle'); return }
    parseTranscript(transcript)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  async function parseTranscript(text: string) {
    try {
      setParsingMsg('Understanding your command…')
      const res  = await fetch('/api/ai/voice-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      let data: VoiceResult = await res.json()
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Parse failed')

      // For meal intents: chain the nutrition autofill to get macros
      if (data.type === 'meal') {
        setParsingMsg('Analyzing nutrition…')
        try {
          const autofillRes = await fetch('/api/nutrition/autofill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foodName: data.food_name }),
          })
          if (autofillRes.ok) {
            const nutrition: NutritionEstimate = await autofillRes.json()
            setNutritionData(nutrition)
            // Use autofill's cleaned-up food name
            data = { ...data, food_name: nutrition.food_name }
          }
        } catch { /* non-fatal — proceed without macros */ }
      }

      // For habit intents, try to match to a real habit
      if (data.type === 'habit') {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: habits } = await supabase
            .from('personality_habits')
            .select('id, habit_name, category, streak_count, longest_streak, last_done_at, frequency, is_keystone')
            .eq('user_id', session.user.id)
          const needle = data.habit_name.toLowerCase()
          const match = (habits as Habit[] ?? []).find(h =>
            h.habit_name.toLowerCase().includes(needle) ||
            needle.includes(h.habit_name.toLowerCase())
          )
          setMatchedHabit(match ?? null)
        }
      }

      setResult(data)
      setState('confirm')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to parse command')
      setState('error')
    }
  }

  async function confirmLog() {
    if (!result) return
    setState('saving')
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setState('error'); setErrorMsg('Not signed in'); return }
    const uid   = session.user.id
    const today = todayStr()

    try {
      if (result.type === 'transaction') {
        await supabase.from('transactions').insert({
          user_id:     uid,
          txn_date:    today,
          type:        result.txn_type,
          category:    result.category,
          amount:      result.amount,
          description: result.description || null,
        })
      } else if (result.type === 'workout') {
        await supabase.from('workout_logs').insert({
          user_id:       uid,
          log_date:      today,
          workout_type:  result.workout_type,
          duration_mins: result.duration_mins ?? 0,
          exercises:     [],
          notes:         result.notes || null,
        })
      } else if (result.type === 'meal') {
        await supabase.from('nutrition_logs').insert({
          user_id:   uid,
          log_date:  today,
          meal_type: result.meal_type,
          food_name: nutritionData?.food_name || result.food_name,
          calories:  nutritionData?.calories  ?? 0,
          protein_g: nutritionData?.protein_g ?? 0,
          carbs_g:   nutritionData?.carbs_g   ?? 0,
          fat_g:     nutritionData?.fat_g     ?? 0,
          fiber_g:   nutritionData?.fiber_g   ?? 0,
          logged_at: new Date().toISOString(),
        })
      } else if (result.type === 'habit' && matchedHabit) {
        const h         = matchedHabit
        const newStreak = computeStreak(h.streak_count, h.last_done_at, h.frequency)
        const now       = new Date().toISOString()
        await Promise.all([
          supabase.from('personality_habits').update({
            streak_count:   newStreak,
            longest_streak: Math.max(newStreak, h.longest_streak),
            last_done_at:   now,
            updated_at:     now,
          }).eq('id', h.id),
          supabase.from('habit_logs').upsert(
            { user_id: uid, habit_id: h.id, log_date: today, status: 'done' },
            { onConflict: 'habit_id,user_id,log_date' }
          ),
        ])
        celebrate()
      } else if (result.type === 'journal') {
        await supabase.from('journal_entries').insert({
          title:      result.title?.trim() || null,
          content:    result.content.trim(),
          mood:       null,
          entry_date: today,
        })
      }
      setState('done')
      setTimeout(onDone, 1200)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Save failed')
      setState('error')
    }
  }

  function retry() {
    setTranscript(''); setResult(null); setErrorMsg('')
    setMatchedHabit(null); setNutritionData(null)
    setState('idle')
  }

  // ── Renders ──────────────────────────────────────────────────────

  if (state === 'unsupported') return (
    <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
      <MicOff className="h-10 w-10 text-slate-600" />
      <p className="text-sm text-slate-400 font-medium">Voice not supported</p>
      <p className="text-xs text-slate-600">Use Chrome or Safari on mobile for voice input.</p>
    </div>
  )

  if (state === 'done') return (
    <div className="flex flex-col items-center gap-3 py-10">
      {celebrationNode}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
        <Check className="h-7 w-7 text-emerald-400" />
      </div>
      <p className="text-sm font-medium text-white">Logged!</p>
      <p className="text-xs text-slate-500">{result?.summary}</p>
    </div>
  )

  if (state === 'error') return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 w-full">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="text-left leading-snug">{errorMsg}</span>
      </div>
      <button onClick={retry} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </button>
    </div>
  )

  const meta = result ? (INTENT_META[result.type] ?? INTENT_META.unknown) : null

  return (
    <div className="space-y-5">
      {celebrationNode}
      {/* Instruction */}
      {state === 'idle' && (
        <p className="text-xs text-center text-slate-500">
          Tap the mic and say something like<br />
          <span className="text-slate-400">"Had two egg dosa for breakfast"</span><br />
          <span className="text-slate-400">"breakfast 85"</span> · <span className="text-slate-400">"lunch 200"</span> · <span className="text-slate-400">"chai 30"</span><br />
          <span className="text-slate-400">"Spent ₹150 on coffee"</span> · <span className="text-slate-400">"Did yoga for 30 mins"</span>
        </p>
      )}

      {/* Transcript display */}
      {(state === 'listening' || state === 'parsing' || state === 'confirm') && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-h-[52px]">
          <p className="text-sm text-white leading-relaxed">
            {transcript}
            {interim && <span className="text-slate-500"> {interim}</span>}
            {!transcript && !interim && state === 'listening' && (
              <span className="text-slate-600 italic">Listening…</span>
            )}
          </p>
        </div>
      )}

      {/* Mic button */}
      {(state === 'idle' || state === 'listening') && (
        <div className="flex flex-col items-center gap-2 py-2">
          <button
            onClick={state === 'listening' ? stopListening : startListening}
            className={cn(
              'relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all',
              state === 'listening'
                ? 'border-red-500 bg-red-500/20 text-red-400 scale-110'
                : 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400 hover:scale-105 active:scale-95',
            )}
          >
            {state === 'listening' && (
              <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20 pointer-events-none" />
            )}
            <Mic className="h-8 w-8" />
          </button>
          {state === 'listening' && (
            <p className="text-xs text-slate-500 text-center">
              Tap to stop · auto-stops after 3 s of silence
            </p>
          )}
        </div>
      )}

      {/* Parsing spinner */}
      {state === 'parsing' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs text-slate-500">{parsingMsg}</p>
        </div>
      )}

      {/* Parsed result preview */}
      {state === 'confirm' && result && meta && (
        <div className={cn('rounded-xl border px-4 py-3.5 space-y-2', meta.bg)}>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold uppercase tracking-wider', meta.color)}>{meta.label}</span>
            {result.type === 'unknown' && <AlertCircle className="h-3.5 w-3.5 text-slate-500" />}
          </div>
          <p className="text-sm text-white leading-snug">{result.summary}</p>

          {/* Compact details */}
          {result.type === 'transaction' && (
            <p className="text-xs text-slate-400">
              {result.txn_type} · ₹{result.amount} · {result.category}
              {result.description && ` · ${result.description}`}
            </p>
          )}
          {result.type === 'workout' && result.duration_mins && (
            <p className="text-xs text-slate-400">{result.workout_type} · {result.duration_mins} min</p>
          )}
          {result.type === 'meal' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 capitalize">{result.meal_type} · {result.food_name}</p>
              {nutritionData && (
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { label: 'kcal',    value: nutritionData.calories,  color: 'text-amber-300'  },
                    { label: 'protein', value: `${nutritionData.protein_g}g`, color: 'text-sky-300'    },
                    { label: 'carbs',   value: `${nutritionData.carbs_g}g`,   color: 'text-violet-300' },
                    { label: 'fat',     value: `${nutritionData.fat_g}g`,     color: 'text-orange-300' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center rounded-lg bg-black/20 py-1.5">
                      <span className={cn('text-sm font-bold', color)}>{value}</span>
                      <span className="text-[10px] text-slate-500">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {result.type === 'habit' && (
            <p className="text-xs text-slate-400">
              {matchedHabit ? `Matched: "${matchedHabit.habit_name}"` : `No habit matching "${result.habit_name}" found`}
            </p>
          )}
          {result.type === 'journal' && (
            <p className="text-xs text-slate-400 line-clamp-2">
              {result.title ? <><span className="text-rose-300/80">{result.title}</span> · </> : null}
              {result.content}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {state === 'confirm' && result && result.type !== 'unknown' && (
        !(result.type === 'habit' && !matchedHabit) ? (
          <div className="flex gap-2">
            <button
              onClick={confirmLog}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition-all"
            >
              <Check className="h-4 w-4" /> Log it
            </button>
            <button
              onClick={retry}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm text-slate-400 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={retry} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400 hover:text-white transition-all">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        )
      )}
      {state === 'confirm' && result?.type === 'unknown' && (
        <button onClick={retry} className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400 hover:text-white transition-all">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}

      {state === 'saving' && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      )}
    </div>
  )
}

// ─── Task Panel ───────────────────────────────────────────────────

function TaskPanel({ onDone }: { onDone: () => void }) {
  const [title, setTitle]   = useState('')
  const [notes, setNotes]   = useState('')
  const [dueDate, setDue]   = useState(todayStr())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('user_todos').insert({
      user_id:  user.id,
      title:    title.trim(),
      notes:    notes.trim() || null,
      due_date: dueDate || null,
    })
    setSaving(false); setSaved(true)
    setTimeout(onDone, 900)
  }

  if (saved) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/30">
        <Check className="h-6 w-6 text-orange-400" />
      </div>
      <p className="text-sm text-slate-300">Task added!</p>
    </div>
  )

  return (
    <div className="space-y-3.5">
      <input
        autoFocus
        placeholder="What needs to be done?"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSave() }}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
      />
      <div className="space-y-1.5">
        <label className="text-xs text-slate-500">Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDue(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 [color-scheme:dark]"
        />
      </div>
      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-orange-500"
      />
      <button
        onClick={handleSave}
        disabled={saving || !title.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Add Task
      </button>
    </div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────

const TABS: {
  id: Panel; label: string; Icon: React.ElementType
  activeClass: string; inactiveClass: string; route: string
}[] = [
  {
    id: 'voice', label: 'Voice', Icon: Mic,
    activeClass:   'border-emerald-500 bg-emerald-500/20 text-white',
    inactiveClass: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400/80 hover:opacity-100',
    route: '/',
  },
  {
    id: 'habit', label: 'Habits', Icon: CheckSquare,
    activeClass:   'border-emerald-500 bg-emerald-500/20 text-white',
    inactiveClass: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400/80 hover:opacity-100',
    route: '/personality/habits',
  },
  {
    id: 'meal', label: 'Meal', Icon: Utensils,
    activeClass:   'border-amber-500 bg-amber-500/20 text-white',
    inactiveClass: 'border-amber-500/20 bg-amber-500/8 text-amber-400/80 hover:opacity-100',
    route: '/fitness?tab=Nutrition',
  },
  {
    id: 'workout', label: 'Workout', Icon: Dumbbell,
    activeClass:   'border-sky-500 bg-sky-500/20 text-white',
    inactiveClass: 'border-sky-500/20 bg-sky-500/8 text-sky-400/80 hover:opacity-100',
    route: '/fitness',
  },
  {
    id: 'sleep', label: 'Sleep', Icon: Moon,
    activeClass:   'border-indigo-500 bg-indigo-500/20 text-white',
    inactiveClass: 'border-indigo-500/20 bg-indigo-500/8 text-indigo-400/80 hover:opacity-100',
    route: '/personality/habits',
  },
  {
    id: 'finance', label: 'Finance', Icon: CreditCard,
    activeClass:   'border-violet-500 bg-violet-500/20 text-white',
    inactiveClass: 'border-violet-500/20 bg-violet-500/8 text-violet-400/80 hover:opacity-100',
    route: '/finance?tab=Tracker',
  },
  {
    id: 'journal', label: 'Journal', Icon: BookOpen,
    activeClass:   'border-rose-500 bg-rose-500/20 text-white',
    inactiveClass: 'border-rose-500/20 bg-rose-500/8 text-rose-400/80 hover:opacity-100',
    route: '/personality/journal',
  },
  {
    id: 'task', label: 'Task', Icon: ClipboardList,
    activeClass:   'border-orange-500 bg-orange-500/20 text-white',
    inactiveClass: 'border-orange-500/20 bg-orange-500/8 text-orange-400/80 hover:opacity-100',
    route: '/focus',
  },
]

// ─── Main export ──────────────────────────────────────────────────

export default function QuickLog() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [panel, setPanel]     = useState<Panel>('voice')
  const [pinging, setPinging] = useState(true)
  const fab = useDraggableFab('quicklog_fab_pos')

  useEffect(() => {
    const t = setTimeout(() => setPinging(false), 3000)
    return () => clearTimeout(t)
  }, [])

  function close() { setOpen(false) }
  function handleDone() { close() }

  return (
    <>
      {/* ── FAB ── */}
      <div
        ref={fab.ref}
        style={fab.style}
        onPointerDown={fab.handlers.onPointerDown}
        className="fixed bottom-[4.75rem] left-4 z-40 cursor-grab active:cursor-grabbing sm:bottom-6 sm:left-6 md:left-[280px]"
      >
        {pinging && <span className="absolute inset-0 rounded-full animate-ping bg-emerald-500/30 pointer-events-none" />}
        <button
          onClick={() => { if (!fab.wasDragged()) setOpen(true) }}
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

            {/* Tab strip — single click switches tab, double click navigates to full section */}
            <div className="flex gap-1.5 px-5 py-3 shrink-0">
              {TABS.map(({ id, label, Icon, activeClass, inactiveClass, route }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPanel(id)}
                  onDoubleClick={() => { close(); router.push(route) }}
                  title={`Double-click to open ${label}`}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] font-medium transition-all',
                    panel === id ? activeClass : inactiveClass,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0">
              {panel === 'voice'   && <VoicePanel   onDone={handleDone} />}
              {panel === 'meal'    && <MealPanel    onDone={handleDone} />}
              {panel === 'workout' && <WorkoutPanel onDone={handleDone} />}
              {panel === 'sleep'   && <SleepPanel   onDone={handleDone} />}
              {panel === 'habit'   && <HabitPanel />}
              {panel === 'finance' && <FinancePanel onDone={handleDone} />}
              {panel === 'journal' && <JournalPanel onDone={handleDone} />}
              {panel === 'task'    && <TaskPanel    onDone={handleDone} />}
            </div>

          </div>
        </div>
      )}
    </>
  )
}
