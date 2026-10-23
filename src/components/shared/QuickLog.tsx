'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Utensils, Dumbbell, CreditCard, BookOpen,
  Loader2, Check, Camera, Image as ImageIcon, Zap, Sparkles, AlertCircle, CheckCircle2,
  Mic, MicOff, RefreshCw, ClipboardList, Moon, Flame, ListChecks, ChevronLeft, ChevronRight, ExternalLink,
  StickyNote, Pin,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { useInFlightIds } from '@/hooks/useInFlightIds'
import { useDraggableFab } from '@/hooks/useDraggableFab'
import { useHabitCelebration } from '@/hooks/useHabitCelebration'
import { HabitCategory, HABIT_CATEGORY_META } from '@/lib/habitCategories'
import { cn } from '@/lib/utils'
import StreakFlame from '@/components/ui/streak-flame'
import { computeStreak, todayStr, yesterdayStr, isGraceActive } from '@/lib/habitStreak'
import { completeHabit } from '@/lib/completeHabit'
import { insertItem } from '@/lib/planner/actions'
import { useReward } from '@/contexts/RewardContext'
import RichTextEditor from './RichTextEditor'
import OpenPlanList from '@/components/planner/OpenPlanList'
import { mergeFinalTranscripts } from '@/lib/speechTranscript'
import { matchHabit } from '@/lib/habitMatch'
import { averageClock, topRepeats, usualWorkout } from '@/lib/logDefaults'
import TodayLog from './TodayLog'
import { sleepWindow } from '@/lib/todayLog'
import { isBlankNote } from '@/lib/notes'
import { dragOffset, gestureAxis, swipeCommits } from '@/lib/swipe'

type Panel = 'today' | 'plans' | 'voice' | 'meal' | 'workout' | 'finance' | 'journal' | 'note' | 'task' | 'sleep'
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

async function sessionUserId(): Promise<string | null> {
  const { data: { session } } = await createSupabaseBrowserClient().auth.getSession()
  return session?.user?.id ?? null
}

// One-tap suggestion chip used across panels.
function SuggestChip({ onClick, children, tone }: { onClick: () => void; children: React.ReactNode; tone: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95', tone)}>
      {children}
    </button>
  )
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

  // Meals you've logged before — one tap fills name and nutrition.
  const [recentMeals, setRecentMeals] = useState<NutritionEstimate[]>([])

  useEffect(() => {
    sessionUserId().then(async uid => {
      setUserId(uid)
      if (!uid) return
      const { data } = await createSupabaseBrowserClient().from('nutrition_logs')
        .select('food_name, calories, protein_g, carbs_g, fiber_g, fat_g')
        .eq('user_id', uid).order('logged_at', { ascending: false }).limit(150)
      setRecentMeals(topRepeats(data ?? [], r => r.food_name.trim().toLowerCase(), 6)
        .map(r => ({ ...r, protein_g: r.protein_g ?? 0, carbs_g: r.carbs_g ?? 0, fiber_g: r.fiber_g ?? 0, fat_g: r.fat_g ?? 0, notes: '' })))
    })
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

      {recentMeals.length > 0 && !aiReady && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">Recent, tap to fill:</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {recentMeals.map(m => (
              <SuggestChip key={m.food_name} onClick={() => fillFromEstimate(m)}
                tone="border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20">
                {m.food_name} · {m.calories} kcal
              </SuggestChip>
            ))}
          </div>
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
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-snow transition-all">
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

const DURATION_CHIPS = [15, 20, 30, 45, 60, 90]

function WorkoutPanel({ onDone }: { onDone: () => void }) {
  const [workoutType, setWorkoutType] = useState<WorkoutType>('strength')
  const [duration, setDuration]       = useState('30')
  const [customDuration, setCustomDuration] = useState(false)
  const [notes, setNotes]             = useState('')
  const [showNotes, setShowNotes]     = useState(false)
  const [usual, setUsual]             = useState<{ workout_type: string; duration_mins: number } | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  // Start from what you usually do.
  useEffect(() => {
    sessionUserId().then(async uid => {
      if (!uid) return
      const { data } = await createSupabaseBrowserClient().from('workout_logs')
        .select('workout_type, duration_mins').eq('user_id', uid)
        .order('log_date', { ascending: false }).limit(30)
      const u = usualWorkout(data ?? [])
      if (!u) return
      setUsual(u)
      setWorkoutType(u.workout_type as WorkoutType)
      setDuration(String(u.duration_mins))
      setCustomDuration(!DURATION_CHIPS.includes(u.duration_mins))
    })
  }, [])

  async function save(type: WorkoutType, mins: number) {
    if (type !== 'rest' && !mins) return
    setSaving(true)
    const uid = await sessionUserId()
    if (!uid) { setSaving(false); return }
    await createSupabaseBrowserClient().from('workout_logs').insert({
      user_id:       uid,
      log_date:      todayStr(),
      workout_type:  type,
      duration_mins: mins || 0,
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

  const usualMeta = usual && WORKOUT_TYPES.find(t => t.value === usual.workout_type)
  return (
    <div className="space-y-3.5">
      {usual && usualMeta && (
        <button type="button" onClick={() => save(usual.workout_type as WorkoutType, usual.duration_mins)} disabled={saving}
          className="flex w-full items-center gap-3 rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-500/15 to-sky-500/5 px-3 py-2.5 text-left transition-all hover:bg-sky-500/20 active:scale-[0.98] disabled:opacity-60">
          <span className="text-xl">{usualMeta.icon}</span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-white">Log your usual</span>
            <span className="block text-[11px] text-sky-300">{usualMeta.label} · {usual.duration_mins} min · one tap</span>
          </span>
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : <Check className="h-4 w-4 text-sky-300" />}
        </button>
      )}

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
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {DURATION_CHIPS.map(m => (
              <button key={m} type="button" onClick={() => { setDuration(String(m)); setCustomDuration(false) }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95',
                  !customDuration && duration === String(m)
                    ? 'border-sky-500 bg-sky-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
                )}>
                {m}m
              </button>
            ))}
            <button type="button" onClick={() => setCustomDuration(true)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                customDuration ? 'border-sky-500 bg-sky-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
              )}>
              Other
            </button>
          </div>
          {customDuration && (
            <input
              autoFocus
              type="number" min={1} inputMode="numeric"
              placeholder="Minutes"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(workoutType, Number(duration)) }}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
            />
          )}
        </div>
      )}

      {showNotes ? (
        <textarea
          autoFocus
          placeholder="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-sky-500"
        />
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="text-xs text-slate-500 hover:text-slate-300">+ Add a note</button>
      )}

      <button
        onClick={() => save(workoutType, Number(duration))}
        disabled={saving || (workoutType !== 'rest' && !Number(duration))}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-snow transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {workoutType === 'rest' ? 'Log rest day' : Number(duration) ? `Log ${duration} min` : 'Pick how long'}
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
  const [basedOn, setBasedOn]   = useState(0)

  // Start from your own recent average (or tonight's entry if it exists).
  useEffect(() => {
    sessionUserId().then(async uid => {
      if (!uid) return
      const { data } = await createSupabaseBrowserClient().from('sleep_logs')
        .select('sleep_date, bedtime, wake_time, quality').eq('user_id', uid)
        .order('sleep_date', { ascending: false }).limit(14)
      const rows = data ?? []
      const today = rows.find(r => r.sleep_date === todayStr())
      if (today?.bedtime && today?.wake_time) {
        setBedtime(today.bedtime.slice(0, 5)); setWakeTime(today.wake_time.slice(0, 5)); setQuality(today.quality ?? 0)
        return
      }
      const b = averageClock(rows.map(r => r.bedtime)), w = averageClock(rows.map(r => r.wake_time))
      if (b) setBedtime(b)
      if (w) setWakeTime(w)
      setBasedOn(rows.length)
    })
  }, [])

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
          {basedOn > 1 && <span className="font-normal text-slate-500"> · your usual, from the last {basedOn} nights</span>}
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
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-snow transition-all">
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
      .or(`user_id.eq.${userId},is_global.eq.true`)
      .order('created_at', { ascending: true }),
    [],
  )

  // Includes global habits (same visibility as the Habit Tracker) — respect
  // the per-user hide state the Tracker's "Manage Global" modal writes to,
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

  const { data: logs, loading: logsLoading, setData: setLogs } = useCachedQuery<{ habit_id: string; status: string }[]>(
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
  // Per-habit lock: a slow completion on one habit must not swallow taps on others.
  const { inFlight: markingIds, begin: beginMarking, end: endMarking } = useInFlightIds()
  const [catchUpId, setCatchUpId]     = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissedRaw] = useState(false)
  const { celebrate, celebrationNode } = useHabitCelebration()
  const { celebrateMilestones } = useReward()

  const loading = habitsLoading || logsLoading

  useEffect(() => {
    try { setBannerDismissedRaw(localStorage.getItem(`habit_grace_dismissed_${today}`) === '1') } catch {}
  }, [today])

  useEffect(() => {
    const done   = new Set<string>()
    const missed = new Set<string>()
    for (const row of logs) {
      if (row.status === 'done')        done.add(row.habit_id)
      if (row.status === 'missed')      missed.add(row.habit_id)
      // 'auto_missed' is the nightly cron's silent backfill for a habit the
      // user never touched — treat it exactly like a normal missed/skipped
      // habit here too, so it's hidden from the list instead of showing as
      // pending (only isPerfectDay treats it differently).
      if (row.status === 'auto_missed') missed.add(row.habit_id)
    }
    // Fallback: check last_done_at for today
    // Never for global habits: last_done_at there is one shared column across
    // every user, so only this user's own habit_logs row can say "done today".
    for (const h of habits) {
      if (h.last_done_at && !h.is_global) {
        const d = new Date(h.last_done_at)
        const ds = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
        if (ds === today) done.add(h.id)
      }
    }
    setDoneIds(done)
    setMissedIds(missed)
  }, [habits, logs, today])

  async function markDone(habit: Habit) {
    if (doneIds.has(habit.id) || !beginMarking(habit.id)) return

    // Optimistic update goes through the cached logs (not doneIds directly):
    // doneIds is re-derived from logs, so a local-only write would be wiped
    // the moment the panel's still-in-flight logs fetch lands. setLogs also
    // tells useCachedQuery to discard that stale fetch result.
    setLogs(prev => [...prev.filter(l => l.habit_id !== habit.id), { habit_id: habit.id, status: 'done' }])

    try {
      const { streak_count, milestones } = await completeHabit(habit.id)
      setHabits(prev => prev.map(h => h.id === habit.id
        ? { ...h, streak_count, longest_streak: Math.max(streak_count, h.longest_streak), last_done_at: new Date().toISOString() }
        : h
      ))
      celebrate()
      celebrateMilestones(milestones)
    } catch {
      setLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.status === 'done')))
    }
    endMarking(habit.id)
  }

  function dismissBanner() {
    setBannerDismissedRaw(true)
    try { localStorage.setItem(`habit_grace_dismissed_${today}`, '1') } catch {}
  }

  async function markDoneForYesterday(habit: Habit) {
    if (catchUpId) return

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
              <span className="min-w-0 break-words text-xs text-slate-300">{habit.habit_name}</span>
              <button
                onClick={() => markDoneForYesterday(habit)}
                disabled={catchUpId === habit.id}
                className="shrink-0 flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 px-2 py-1 text-[11px] font-medium text-snow transition-colors disabled:opacity-50"
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
      <div className="space-y-2">
        {[...pending, ...doneList].map(habit => {
          const isDone = doneIds.has(habit.id)
          return (
            <button
              key={habit.id}
              onClick={() => markDone(habit)}
              disabled={isDone || markingIds.has(habit.id)}
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
                {markingIds.has(habit.id)
                  ? <Loader2 className="h-3 w-3 animate-spin text-white" />
                  : isDone
                    ? <Check className="h-3 w-3 text-white" />
                    : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('break-words text-sm font-medium', isDone ? 'text-slate-500 line-through' : 'text-white')}>
                  {habit.habit_name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full capitalize', CAT_BADGE[habit.category] ?? 'bg-white/10 text-slate-400')}>
                    {habit.category}
                  </span>
                  {habit.streak_count > 0 && !isDone && (
                    <span className="text-xs text-orange-400"><StreakFlame seed={habit.streak_count} /> {habit.streak_count}</span>
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

// ─── Plans Panel ──────────────────────────────────────────────────

// Everything to check off today in one place: open planner tasks
// (today / this week / this month) and today's habits.
function PlansPanel({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-5">
      <OpenPlanList onNavigate={onDone} />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <p className="text-sm font-semibold text-white">Habits</p>
        </div>
        <HabitPanel />
      </div>
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

  // Your most repeated expenses — one tap fills category, amount, note.
  const [frequent, setFrequent] = useState<{ category: string; amount: number; description: string | null }[]>([])
  useEffect(() => {
    sessionUserId().then(async uid => {
      if (!uid) return
      const since = new Date(); since.setDate(since.getDate() - 90)
      const { data } = await createSupabaseBrowserClient().from('transactions')
        .select('category, amount, description').eq('user_id', uid).eq('type', 'expense')
        .gte('txn_date', since.toISOString().slice(0, 10))
        .order('txn_date', { ascending: false }).limit(300)
      setFrequent(topRepeats(data ?? [], r => `${r.category}|${Number(r.amount)}|${(r.description ?? '').trim().toLowerCase()}`, 6))
    })
  }, [])

  function applyFrequent(f: { category: string; amount: number; description: string | null }) {
    setTxnType('expense')
    setCategory(CATS.expense.includes(f.category) ? f.category : 'Other')
    setAmount(String(Number(f.amount)))
    setDesc(f.description ?? '')
  }

  function bump(n: number) {
    setAmount(a => String(Math.round(((Number(a) || 0) + n) * 100) / 100))
  }

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
      {frequent.length > 0 && txnType === 'expense' && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">Your usual, tap to fill:</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {frequent.map(f => (
              <SuggestChip key={`${f.category}|${f.amount}|${f.description}`} onClick={() => applyFrequent(f)}
                tone="border-violet-500/25 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20">
                {f.description || f.category} · ₹{Number(f.amount).toLocaleString('en-IN')}
              </SuggestChip>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-1.5">
        {[10, 50, 100, 500].map(n => (
          <button key={n} type="button" onClick={() => bump(n)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-semibold text-slate-300 hover:border-violet-500/40 active:scale-95 transition-all">
            +{n}
          </button>
        ))}
      </div>
      <input
        type="number" min={0} step="0.01" inputMode="decimal"
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
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-snow transition-all"
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
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-snow transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Entry
      </button>
    </div>
  )
}

// ─── Note Panel ──────────────────────────────────────────────────

function NotePanel({ onDone }: { onDone: () => void }) {
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState(false)
  const blank = isBlankNote(title, content)

  async function handleSave() {
    if (blank) return
    setSaving(true); setError(false)
    const uid = await sessionUserId()
    const { error } = uid
      ? await createSupabaseBrowserClient().from('notes').insert({ user_id: uid, title: title.trim(), content, is_pinned: pinned })
      : { error: true }
    setSaving(false)
    if (error) { setError(true); return }
    setSaved(true)
    setTimeout(onDone, 900)
  }

  if (saved) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30">
        <Check className="h-6 w-6 text-amber-400" />
      </div>
      <p className="text-sm text-slate-300">{pinned ? 'Note saved and pinned' : 'Note saved'}</p>
    </div>
  )

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2">
        <input
          placeholder="Title (optional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
        />
        <button type="button" onClick={() => setPinned(p => !p)}
          title={pinned ? 'Unpin' : 'Pin to top'} aria-pressed={pinned}
          className={cn('flex items-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
            pinned ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white')}>
          <Pin className={cn('h-3.5 w-3.5', pinned && 'fill-amber-300')} /> {pinned ? 'Pinned' : 'Pin'}
        </button>
      </div>

      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder="Write anything, or tap Checklist for a list…"
        checklist
      />

      {error && <p className="text-xs text-rose-400">Couldn&apos;t save the note. Check your connection and try again.</p>}

      <button
        onClick={handleSave}
        disabled={saving || blank}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-slate-950 transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Note
      </button>
    </div>
  )
}

// ─── Voice Panel ─────────────────────────────────────────────────

type VoiceState = 'idle' | 'listening' | 'parsing' | 'confirm' | 'confirmMany' | 'saving' | 'done' | 'error' | 'unsupported'

type VoiceResult =
  | { type: 'transaction'; txn_type: 'expense' | 'income' | 'savings'; amount: number; category: string; description: string; summary: string }
  | { type: 'workout';     workout_type: string; duration_mins: number | null; notes: string; summary: string }
  | { type: 'meal';        meal_type: string; food_name: string; summary: string }
  | { type: 'habit';       habit_name: string; summary: string }
  | { type: 'journal';     title: string | null; content: string; summary: string }
  | { type: 'sleep';       hours: number | null; bedtime: string | null; wake_time: string | null; quality: number | null; summary: string }
  | { type: 'water';       amount_ml: number; summary: string }
  | { type: 'mood';        mood: number; word: string | null; summary: string }
  | { type: 'unknown';     summary: string }

// One entry on the "log several things" screen.
interface VoiceItem {
  result:    VoiceResult
  include:   boolean
  nutrition: NutritionEstimate | null
  habit:     Habit | null
  note:      string | null   // why it can't be logged as-is
}

const VOICE_ITEM_ICON: Record<VoiceResult['type'], string> = {
  transaction: '💸', workout: '💪', meal: '🍽', habit: '✅', journal: '📓', sleep: '😴', water: '💧', mood: '😊', unknown: '❓',
}

// Writes one parsed voice entry (habits are completed by the caller, which
// also runs the celebration).
async function saveVoiceItem(
  supabase: ReturnType<typeof createSupabaseBrowserClient>, uid: string,
  result: VoiceResult, nutrition: NutritionEstimate | null,
) {
  const today = todayStr()
  if (result.type === 'transaction') {
    await supabase.from('transactions').insert({
      user_id: uid, txn_date: today, type: result.txn_type, category: result.category,
      amount: result.amount, description: result.description || null,
    })
  } else if (result.type === 'workout') {
    await supabase.from('workout_logs').insert({
      user_id: uid, log_date: today, workout_type: result.workout_type,
      duration_mins: result.duration_mins ?? 0, exercises: [], notes: result.notes || null,
    })
  } else if (result.type === 'meal') {
    await supabase.from('nutrition_logs').insert({
      user_id: uid, log_date: today, meal_type: result.meal_type,
      food_name: nutrition?.food_name || result.food_name,
      calories: nutrition?.calories ?? 0, protein_g: nutrition?.protein_g ?? 0, carbs_g: nutrition?.carbs_g ?? 0,
      fat_g: nutrition?.fat_g ?? 0, fiber_g: nutrition?.fiber_g ?? 0, logged_at: new Date().toISOString(),
    })
  } else if (result.type === 'journal') {
    await supabase.from('journal_entries').insert({
      title: result.title?.trim() || null, content: result.content.trim(), mood: null, entry_date: today,
    })
  } else if (result.type === 'water') {
    await supabase.from('water_logs').insert({ user_id: uid, log_date: today, amount_ml: result.amount_ml, logged_at: new Date().toISOString() })
  } else if (result.type === 'mood') {
    const { data: existing } = await supabase.from('mood_checkins').select('energy').eq('user_id', uid).eq('checked_at', today).maybeSingle()
    await supabase.from('mood_checkins').upsert({
      user_id: uid, checked_at: today, mood: Math.min(5, Math.max(1, Math.round(result.mood))),
      energy: existing?.energy ?? 3, word: result.word,
    }, { onConflict: 'user_id,checked_at' })
  } else if (result.type === 'sleep') {
    let bedtime = result.bedtime, wake = result.wake_time
    if (!(bedtime && wake) && result.hours) {
      // "slept 7 hours": count back from the given or usual wake time.
      const { data: recent } = await supabase.from('sleep_logs').select('wake_time').eq('user_id', uid)
        .order('sleep_date', { ascending: false }).limit(14)
      const usualWake = wake ?? averageClock((recent ?? []).map(r => r.wake_time)) ?? '06:30'
      ;({ bedtime, wake_time: wake } = sleepWindow(result.hours, usualWake))
    }
    if (!bedtime || !wake) throw new Error('Say how long you slept, or when you slept and woke')
    await supabase.from('sleep_logs').upsert({
      user_id: uid, sleep_date: today, bedtime, wake_time: wake,
      quality: result.quality ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,sleep_date' })
  }
}

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
  // Closest habits when the voice match isn't certain — shown as a picker.
  const [habitOptions, setHabitOptions]   = useState<Habit[]>([])
  const [nutritionData, setNutritionData] = useState<NutritionEstimate | null>(null)
  const [parsingMsg, setParsingMsg]       = useState('Understanding your command…')
  const [many, setMany]                   = useState<VoiceItem[]>([])
  const { celebrate, celebrationNode } = useHabitCelebration()
  const { celebrateMilestones } = useReward()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks the next expected final-result index to prevent mobile Chrome from
  // re-appending already-committed finals when e.resultIndex is unreliable.

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

      // Rebuild from the whole result list each time rather than appending —
      // Android re-sends and accumulates finals (see mergeFinalTranscripts).
      const finals: string[] = []; let inter = ''
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finals.push(t)
        else inter += t
      }
      const final = mergeFinalTranscripts(finals)
      setTranscript(final)
      // Android also echoes the finished text as interim; don't show it twice.
      setInterim(final && final.toLowerCase().includes(inter.trim().toLowerCase()) ? '' : inter)

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
      const raw = await res.json()
      if (!res.ok) throw new Error(raw.error ?? 'Parse failed')
      const list: VoiceResult[] = Array.isArray(raw.items) ? raw.items : [raw]
      // Several things, or a kind the single-entry screen doesn't show:
      // go to the "log several things" screen.
      if (list.length > 1 || ['sleep', 'water', 'mood'].includes(list[0]?.type)) {
        await prepareMany(list)
        return
      }
      let data: VoiceResult = list[0]

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

      // For habit intents, try to match to a real habit. Also when the AI
      // couldn't classify the command — it may still be a habit's name.
      setMatchedHabit(null); setHabitOptions([])
      if (data.type === 'habit' || data.type === 'unknown') {
        const supabase = createSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Same set the Habit Tracker shows: own + global, minus hidden.
          const [{ data: habits }, { data: hidden }] = await Promise.all([
            supabase
              .from('personality_habits')
              .select('id, habit_name, category, streak_count, longest_streak, last_done_at, frequency, is_keystone, is_global')
              .or(`user_id.eq.${session.user.id},is_global.eq.true`),
            supabase.from('user_hidden_habits').select('habit_id').eq('user_id', session.user.id),
          ])
          const hiddenIds = new Set((hidden ?? []).map(h => h.habit_id as string))
          const visible = ((habits ?? []) as Habit[]).filter(h => !h.is_global || !hiddenIds.has(h.id))
          // Approximate match on both the AI's extracted name and the raw words.
          const { match, candidates } = matchHabit(data.type === 'habit' ? [data.habit_name, text] : [text], visible)
          if (data.type === 'unknown' && candidates.length) {
            data = { type: 'habit', habit_name: text, summary: 'Mark a habit as done' }
          }
          setMatchedHabit(match)
          setHabitOptions(candidates.map(c => c.habit))
        }
      }

      setResult(data)
      setState('confirm')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to parse command')
      setState('error')
    }
  }

  async function prepareMany(list: VoiceResult[]) {
    setParsingMsg(`Preparing ${list.length} entries…`)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    let habits: Habit[] = []
    if (session?.user && list.some(r => r.type === 'habit')) {
      const [{ data: hs }, { data: hidden }] = await Promise.all([
        supabase.from('personality_habits')
          .select('id, habit_name, category, streak_count, longest_streak, last_done_at, frequency, is_keystone, is_global')
          .or(`user_id.eq.${session.user.id},is_global.eq.true`),
        supabase.from('user_hidden_habits').select('habit_id').eq('user_id', session.user.id),
      ])
      const hiddenIds = new Set((hidden ?? []).map(h => h.habit_id as string))
      habits = ((hs ?? []) as Habit[]).filter(h => !h.is_global || !hiddenIds.has(h.id))
    }
    const items = await Promise.all(list.map(async (r): Promise<VoiceItem> => {
      if (r.type === 'unknown') return { result: r, include: false, nutrition: null, habit: null, note: "Didn't catch this one" }
      if (r.type === 'habit') {
        const { match } = matchHabit([r.habit_name], habits)
        return match
          ? { result: r, include: true, nutrition: null, habit: match, note: null }
          : { result: r, include: false, nutrition: null, habit: null, note: 'Not sure which habit. Say it on its own to pick' }
      }
      if (r.type === 'meal') {
        try {
          const nr = await fetch('/api/nutrition/autofill', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foodName: r.food_name }),
          })
          if (nr.ok) return { result: r, include: true, nutrition: await nr.json(), habit: null, note: null }
        } catch { /* log without macros */ }
      }
      return { result: r, include: true, nutrition: null, habit: null, note: null }
    }))
    setMany(items)
    setState('confirmMany')
  }

  async function saveMany() {
    setState('saving')
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setState('error'); setErrorMsg('Not signed in'); return }
    let n = 0
    const failed: string[] = []
    for (const item of many.filter(i => i.include)) {
      try {
        if (item.result.type === 'habit' && item.habit) {
          const { milestones } = await completeHabit(item.habit.id)
          celebrate()
          celebrateMilestones(milestones)
        } else {
          await saveVoiceItem(supabase, session.user.id, item.result, item.nutrition)
        }
        n++
      } catch (e) {
        failed.push(`${item.result.summary}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    if (failed.length && !n) { setErrorMsg(failed.join('\n')); setState('error'); return }
    setResult({ type: 'unknown', summary: failed.length ? `Logged ${n}. Couldn't log: ${failed.join('; ')}` : `Logged ${n} thing${n === 1 ? '' : 's'}` })
    setState('done')
    setTimeout(onDone, failed.length ? 3000 : 1500)
  }

  async function confirmLog() {
    if (!result) return
    setState('saving')
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setState('error'); setErrorMsg('Not signed in'); return }
    const uid   = session.user.id

    try {
      if (result.type === 'habit' && matchedHabit) {
        const { milestones } = await completeHabit(matchedHabit.id)
        celebrate()
        celebrateMilestones(milestones)
      } else {
        await saveVoiceItem(supabase, uid, result, nutritionData)
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
    setMatchedHabit(null); setHabitOptions([]); setNutritionData(null)
    setMany([])
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
          <span className="text-slate-400">"Spent ₹150 on coffee"</span> · <span className="text-slate-400">"Did yoga for 30 mins"</span><br />
          <span className="mt-1 inline-block text-emerald-300/80">Or several at once: "Ran 30 minutes, lunch 250, slept 7 hours"</span>
        </p>
      )}

      {/* Transcript display */}
      {(state === 'listening' || state === 'parsing' || state === 'confirm' || state === 'confirmMany') && (
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
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                {matchedHabit
                  ? `Matched: "${matchedHabit.habit_name}"`
                  : habitOptions.length
                    ? 'Which habit did you mean?'
                    : `No habit matching "${result.habit_name}" found`}
              </p>
              {/* Close matches to tap — to pick one, or to correct the auto-match. */}
              {habitOptions.length > (matchedHabit ? 1 : 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {habitOptions.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setMatchedHabit(h)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition-colors',
                        matchedHabit?.id === h.id
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:border-emerald-500/40',
                      )}
                    >
                      {h.habit_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {result.type === 'journal' && (
            <p className="text-xs text-slate-400 line-clamp-2">
              {result.title ? <><span className="text-rose-300/80">{result.title}</span> · </> : null}
              {result.content}
            </p>
          )}
        </div>
      )}

      {/* Several entries: tick what to keep, log them together */}
      {state === 'confirmMany' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">I&apos;ll log {many.filter(i => i.include).length} of these:</p>
          <div className="space-y-2">
            {many.map((item, i) => {
              const r = item.result
              const detail =
                r.type === 'transaction' ? `₹${r.amount.toLocaleString('en-IN')} · ${r.category}`
                : r.type === 'workout'   ? `${r.workout_type}${r.duration_mins ? ` · ${r.duration_mins} min` : ''}`
                : r.type === 'meal'      ? `${item.nutrition?.food_name ?? r.food_name}${item.nutrition ? ` · ${item.nutrition.calories} kcal` : ''}`
                : r.type === 'habit'     ? (item.habit ? `Habit: ${item.habit.habit_name}` : r.habit_name)
                : r.type === 'sleep'     ? (r.bedtime && r.wake_time ? `${r.bedtime} → ${r.wake_time}` : r.hours ? `${r.hours} hours` : '')
                : r.type === 'water'     ? `${r.amount_ml} ml`
                : r.type === 'mood'      ? `${['Rough', 'Low', 'Okay', 'Good', 'Great'][Math.min(5, Math.max(1, r.mood)) - 1]}${r.word ? ` · ${r.word}` : ''}`
                : ''
              const loggable = !item.note
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!loggable}
                  onClick={() => setMany(prev => prev.map((x, j) => j === i ? { ...x, include: !x.include } : x))}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                    item.include ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03] opacity-70',
                  )}
                >
                  <span className="text-lg">{VOICE_ITEM_ICON[r.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">{r.summary}</span>
                    <span className={cn('block truncate text-[11px]', item.note ? 'text-amber-300/80' : 'text-slate-400')}>{item.note ?? detail}</span>
                  </span>
                  {loggable && (
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', item.include ? 'border-emerald-400 bg-emerald-500' : 'border-white/20')}>
                      {item.include && <Check className="h-3.5 w-3.5 text-emerald-950" strokeWidth={3} />}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveMany}
              disabled={!many.some(i => i.include)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-snow transition-all"
            >
              <Check className="h-4 w-4" /> Log {many.filter(i => i.include).length === 1 ? 'it' : `all ${many.filter(i => i.include).length}`}
            </button>
            <button onClick={retry} aria-label="Try again"
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm text-slate-400 transition-all">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {state === 'confirm' && result && result.type !== 'unknown' && (
        !(result.type === 'habit' && !matchedHabit) ? (
          <div className="flex gap-2">
            <button
              onClick={confirmLog}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-sm font-semibold text-snow transition-all"
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
    // A date puts it on that day; no date puts it on this week's list.
    try {
      await insertItem(supabase, user.id, dueDate
        ? { title, notes, period_type: 'day', period_start: dueDate }
        : { title, notes, period_type: 'week', period_start: todayStr() })
    } catch {
      setSaving(false)
      return
    }
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
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-snow transition-all"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Add Task
      </button>
    </div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────

// Detail forms opened from the Today sheet: their title, icon and full page.
const TABS: {
  id: Exclude<Panel, 'today'>; label: string; Icon: React.ElementType
  activeClass: string; inactiveClass: string; route: string
}[] = [
  {
    id: 'plans', label: 'Plans', Icon: ListChecks,
    activeClass:   'border-emerald-500 bg-emerald-500/20 text-white',
    inactiveClass: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400/80 hover:opacity-100',
    route: '/planner',
  },
  {
    id: 'voice', label: 'Voice', Icon: Mic,
    activeClass:   'border-emerald-500 bg-emerald-500/20 text-white',
    inactiveClass: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400/80 hover:opacity-100',
    route: '/',
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
    id: 'note', label: 'Note', Icon: StickyNote,
    activeClass:   'border-amber-500 bg-amber-500/20 text-white',
    inactiveClass: 'border-amber-500/20 bg-amber-500/8 text-amber-400/80 hover:opacity-100',
    route: '/notes',
  },
  {
    id: 'task', label: 'Task', Icon: ClipboardList,
    activeClass:   'border-orange-500 bg-orange-500/20 text-white',
    inactiveClass: 'border-orange-500/20 bg-orange-500/8 text-orange-400/80 hover:opacity-100',
    route: '/focus',
  },
]

// Swipe order: Today first, then each log.
const PAGES: Panel[] = ['today', 'plans', 'meal', 'workout', 'sleep', 'finance', 'journal', 'note', 'task', 'voice']
const pageLabel = (p: Panel) => p === 'today' ? 'Today' : TABS.find(t => t.id === p)!.label
const SWIPE_HINT_KEY = 'growthos:quicklog-swipe-hint'

// Swipes page from anywhere on the sheet, except while typing in a field
// (and in multi-line text, where sideways drags select text).
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.closest) return false
  if (el.closest('textarea, [contenteditable="true"]')) return true
  const field = el.closest('input, select')
  return !!field && field === document.activeElement
}

// Nearest ancestor (below `boundary`) that scrolls sideways — chip rows.
function horizontalScroller(target: EventTarget | null, boundary: HTMLElement): HTMLElement | null {
  let el = target as HTMLElement | null
  while (el && el !== boundary) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX
      if (ox === 'auto' || ox === 'scroll') return el
    }
    el = el.parentElement
  }
  return null
}

// Can `el` still scroll in the direction a finger moving by dx would push it?
function canScrollFurther(el: HTMLElement, dx: number): boolean {
  return dx < 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0
}

// ─── Main export ──────────────────────────────────────────────────

export default function QuickLog() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [panel, setPanel]     = useState<Panel>('today')
  const [pinging, setPinging] = useState(true)
  const fab = useDraggableFab('quicklog_fab_pos')

  useEffect(() => {
    const t = setTimeout(() => setPinging(false), 3000)
    return () => clearTimeout(t)
  }, [])

  // Always reopen on the Today sheet.
  function close() { setOpen(false); setPanel('today') }

  // ── Paging between logs: swipe, ‹ › buttons, or arrow keys ──
  const [dir, setDir] = useState<1 | -1>(1)
  const sheetRef = useRef<HTMLDivElement>(null)
  const slideRef = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(false)

  function goTo(next: Panel) {
    if (next === panel) return
    setDir(PAGES.indexOf(next) >= PAGES.indexOf(panel) ? 1 : -1)
    setPanel(next)
  }
  function page(delta: 1 | -1) {
    const i = PAGES.indexOf(panel) + delta
    if (i < 0 || i >= PAGES.length) return
    goTo(PAGES[i])
    if (showHint) { setShowHint(false); try { localStorage.setItem(SWIPE_HINT_KEY, '1') } catch {} }
  }
  // The native listeners below are attached once per open; read the latest.
  const panelRef = useRef(panel)
  panelRef.current = panel
  const pageRef = useRef(page)
  pageRef.current = page

  useEffect(() => {
    if (!open) return
    try { setShowHint(localStorage.getItem(SWIPE_HINT_KEY) !== '1') } catch {}
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      if (el?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') page(1)
      else if (e.key === 'ArrowLeft') page(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panel, showHint])

  // While open, the page behind must not scroll or slide with the swipes.
  useEffect(() => {
    if (!open) return
    const html = document.documentElement, body = document.body
    const prev = [html.style.overflow, body.style.overflow, body.style.overscrollBehavior]
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; body.style.overscrollBehavior = 'none'
    return () => { [html.style.overflow, body.style.overflow, body.style.overscrollBehavior] = prev }
  }, [open])

  // Drag to page: the current log follows the finger sideways and either
  // slides away to the next log on release or springs back. Native
  // listeners because a non-passive touchmove is needed to stop the
  // browser treating the drag as a scroll or back gesture.
  useEffect(() => {
    if (!open) return
    const sheet = sheetRef.current
    if (!sheet) return
    let g: { x: number; y: number; t: number; mode: 'undecided' | 'page' | 'native'; scroller: HTMLElement | null } | null = null

    const place = (x: number, animate: boolean) => {
      const el = slideRef.current
      if (!el) return
      el.style.transition = animate ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out' : 'none'
      el.style.transform = x ? `translateX(${x}px)` : ''
      el.style.opacity = x ? String(Math.max(0.3, 1 - (Math.abs(x) / sheet.clientWidth) * 0.7)) : ''
    }
    const canGo = (dx: number) => {
      const i = PAGES.indexOf(panelRef.current)
      return dx < 0 ? i < PAGES.length - 1 : i > 0
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length > 1 || isTypingTarget(e.target)) { g = null; return }
      const t = e.touches[0]
      g = { x: t.clientX, y: t.clientY, t: Date.now(), mode: 'undecided', scroller: horizontalScroller(e.target, sheet!) }
    }
    function onMove(e: TouchEvent) {
      if (!g || g.mode === 'native') return
      const t = e.touches[0]
      const dx = t.clientX - g.x, dy = t.clientY - g.y
      if (g.mode === 'undecided') {
        const axis = gestureAxis(dx, dy)
        if (!axis) return
        // A chip row scrolls first; once it's at its end, the swipe pages.
        g.mode = axis === 'y' || (g.scroller && canScrollFurther(g.scroller, dx)) ? 'native' : 'page'
        if (g.mode === 'native') return
      }
      e.preventDefault()
      place(dragOffset(dx, canGo(dx)), false)
    }
    function onEnd(e: TouchEvent) {
      const gesture = g
      g = null
      if (!gesture || gesture.mode !== 'page') return
      const dx = e.changedTouches[0].clientX - gesture.x
      if (canGo(dx) && swipeCommits(dx, Date.now() - gesture.t, sheet!.clientWidth)) {
        const delta = dx < 0 ? 1 : -1
        place(-delta * sheet!.clientWidth, true)
        setTimeout(() => { place(0, false); pageRef.current(delta) }, 200)
      } else {
        place(0, true)
      }
    }
    function onCancel() { if (g?.mode === 'page') place(0, true); g = null }

    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onCancel)
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onCancel)
    }
  }, [open])

  // Saving a detail form returns to Today (which reloads) to keep logging.
  function handleDone() { goTo('today') }

  return (
    <>
      {/* ── FAB ── */}
      <div
        ref={fab.ref}
        style={fab.style}
        onPointerDown={fab.handlers.onPointerDown}
        className="fixed bottom-[4.75rem] left-4 z-50 cursor-grab active:cursor-grabbing sm:bottom-6 sm:left-6 md:left-[280px]"
      >
        {pinging && <span className="absolute inset-0 rounded-full animate-ping bg-emerald-500/30 pointer-events-none" />}
        <button
          onClick={() => { if (!fab.wasDragged()) setOpen(true) }}
          title="Log today"
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-sky-600 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* ── Modal ── */}
      {open && (
        <div
          className="sheet-in fixed inset-0 z-50 flex touch-none items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          {/* Fixed height, so paging between logs feels like flipping equal cards
              instead of the sheet growing and shrinking with each form. */}
          <div ref={sheetRef} className="w-full max-w-md overflow-hidden overscroll-contain rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col h-[min(88dvh,720px)]">

            {/* Header: Today, or a detail form with a way back */}
            <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3 shrink-0">
              {panel === 'today' ? (
                <div>
                  <p className="text-base font-semibold text-white">Today</p>
                  <p className="text-[11px] text-slate-500">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
              ) : (() => {
                const tab = TABS.find(t => t.id === panel)!
                return (
                  <div className="flex min-w-0 items-center gap-1">
                    <button onClick={() => goTo('today')} className="flex items-center gap-0.5 rounded-lg py-1 pr-2 text-xs text-slate-400 hover:text-white" aria-label="Back to Today">
                      <ChevronLeft className="h-4 w-4" /> Today
                    </button>
                    <span className="text-slate-700">/</span>
                    <p className="flex items-center gap-1.5 truncate pl-1 text-sm font-semibold text-white">
                      <tab.Icon className="h-3.5 w-3.5 text-slate-400" /> {tab.label}
                    </p>
                    {tab.route !== '/' && (
                      <button onClick={() => { close(); router.push(tab.route) }} title={`Open ${tab.label} page`} aria-label={`Open ${tab.label} page`}
                        className="ml-1 rounded p-1 text-slate-600 hover:text-slate-300">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })()}
              <button onClick={close} className="text-slate-500 hover:text-white transition-colors p-1 rounded" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Pager: where you are, and what's either side */}
            <div className="flex items-center gap-2 px-5 pb-3 shrink-0">
              <button onClick={() => page(-1)} disabled={panel === PAGES[0]} aria-label="Previous log"
                className="flex w-20 items-center gap-0.5 truncate text-[11px] text-slate-500 hover:text-white disabled:invisible">
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" />{panel !== PAGES[0] && pageLabel(PAGES[PAGES.indexOf(panel) - 1])}
              </button>
              <div className="flex flex-1 items-center justify-center gap-1.5">
                {PAGES.map(p => (
                  <button key={p} onClick={() => goTo(p)} aria-label={pageLabel(p)} title={pageLabel(p)}
                    className={cn('h-1.5 rounded-full transition-all duration-300', p === panel ? 'w-5 bg-emerald-400' : 'w-1.5 bg-white/20 hover:bg-white/40')} />
                ))}
              </div>
              <button onClick={() => page(1)} disabled={panel === PAGES[PAGES.length - 1]} aria-label="Next log"
                className="flex w-20 items-center justify-end gap-0.5 truncate text-[11px] text-slate-500 hover:text-white disabled:invisible">
                {panel !== PAGES[PAGES.length - 1] && pageLabel(PAGES[PAGES.indexOf(panel) + 1])}<ChevronRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
            {showHint && (
              <p className="-mt-1 mb-2 shrink-0 text-center text-[11px] text-emerald-300/80 animate-pulse motion-reduce:animate-none">
                Swipe ← → to move between logs
              </p>
            )}

            {/* Panel content: swipe sideways to page */}
            <div className="flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5 min-h-0">
              <div ref={slideRef} key={panel} className={cn('animate-in fade-in-0 duration-200 motion-reduce:animate-none', dir > 0 ? 'slide-in-from-right-8' : 'slide-in-from-left-8')}>
              {panel === 'today'   && <TodayLog onOpen={goTo} />}
              {/* Plans' onDone fires when a plan link navigates away, so close. */}
              {panel === 'plans'   && <PlansPanel   onDone={close} />}
              {panel === 'voice'   && <VoicePanel   onDone={handleDone} />}
              {panel === 'meal'    && <MealPanel    onDone={handleDone} />}
              {panel === 'workout' && <WorkoutPanel onDone={handleDone} />}
              {panel === 'sleep'   && <SleepPanel   onDone={handleDone} />}
              {panel === 'finance' && <FinancePanel onDone={handleDone} />}
              {panel === 'journal' && <JournalPanel onDone={handleDone} />}
              {panel === 'note'    && <NotePanel    onDone={handleDone} />}
              {panel === 'task'    && <TaskPanel    onDone={handleDone} />}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
