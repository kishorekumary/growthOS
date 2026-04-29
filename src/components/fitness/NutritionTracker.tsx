'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Camera, Loader2, Plus, Trash2, ChevronDown, ChevronUp,
  Flame, Trophy, Star, Zap, Target, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────

interface NutritionLog {
  id: string
  log_date: string
  meal_type: 'breakfast' | 'lunch' | dinner | 'snack'
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fiber_g: number
  fat_g: number
  notes: string | null
}

type dinner = 'dinner'

interface Macros {
  calories: number
  protein_g: number
  carbs_g: number
  fiber_g: number
  fat_g: number
}

interface Goals extends Macros {}

interface NutritionEstimate extends Macros {
  food_name: string
  notes: string
}

// ─── Constants ─────────────────────────────────────────────────

const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein_g: 150,
  carbs_g: 250,
  fiber_g: 30,
  fat_g: 65,
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch:     '☀️',
  dinner:    '🌙',
  snack:     '🍎',
}

// ─── Utilities ─────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }

function sumMacros(logs: NutritionLog[]): Macros {
  return logs.reduce(
    (acc, l) => ({
      calories:  acc.calories  + l.calories,
      protein_g: acc.protein_g + Number(l.protein_g),
      carbs_g:   acc.carbs_g   + Number(l.carbs_g),
      fiber_g:   acc.fiber_g   + Number(l.fiber_g),
      fat_g:     acc.fat_g     + Number(l.fat_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fiber_g: 0, fat_g: 0 }
  )
}

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0
  const sorted = Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a))
  const today     = todayStr()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0
  let streak = 0
  let cursor = new Date(sorted[0])
  for (const d of sorted) {
    if (d === cursor.toISOString().split('T')[0]) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else break
  }
  return streak
}

function pct(val: number, goal: number) {
  return Math.min(100, Math.round((val / goal) * 100))
}

// ─── Macro progress bar ─────────────────────────────────────────

function MacroBar({
  label, value, goal, unit, color,
}: {
  label: string; value: number; goal: number; unit: string; color: string
}) {
  const p = pct(value, goal)
  const barColor = p > 110 ? 'bg-red-500' : p > 90 ? 'bg-emerald-500' : p > 60 ? color : color

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="text-slate-300 tabular-nums">
          {typeof value === 'number' ? value % 1 === 0 ? value : value.toFixed(1) : value}
          <span className="text-slate-600">/{goal}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  )
}

// ─── Calorie ring ──────────────────────────────────────────────

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const r    = 54
  const circ = 2 * Math.PI * r
  const p    = Math.min(1, consumed / goal)
  const offset = circ * (1 - p)
  const over = consumed > goal * 1.1
  const ringColor = over ? 'text-red-400' : p > 0.9 ? 'text-emerald-400' : 'text-violet-400'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width="130" height="130" className="-rotate-90">
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          <circle
            cx="65" cy="65" r={r}
            fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className={cn('transition-all duration-700', ringColor)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white tabular-nums leading-none">{consumed}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">kcal</span>
        </div>
      </div>
      <span className="text-xs text-slate-500">{goal - consumed > 0 ? `${goal - consumed} remaining` : `${consumed - goal} over goal`}</span>
    </div>
  )
}

// ─── Badge chip ────────────────────────────────────────────────

interface Badge {
  id: string; icon: string; label: string; desc: string; earned: boolean
}

function BadgeChip({ badge }: { badge: Badge }) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-center transition-all min-w-[72px]',
      badge.earned
        ? 'border-amber-500/40 bg-amber-500/10'
        : 'border-white/5 bg-white/3 opacity-40 grayscale'
    )}>
      <span className="text-xl leading-none">{badge.icon}</span>
      <span className={cn('text-[10px] font-semibold leading-tight', badge.earned ? 'text-amber-300' : 'text-slate-500')}>
        {badge.label}
      </span>
    </div>
  )
}

function computeBadges(
  streak: number,
  totalDays: number,
  todayTotals: Macros,
  goals: Goals,
  loggedToday: boolean,
): Badge[] {
  const calPct  = todayTotals.calories  / goals.calories
  const protPct = todayTotals.protein_g / goals.protein_g

  return [
    { id: 'first',    icon: '🌱', label: 'First Log',     desc: 'Logged first meal',          earned: totalDays >= 1 },
    { id: 'streak3',  icon: '🔥', label: '3-Day Streak',  desc: '3 consecutive days',         earned: streak >= 3 },
    { id: 'streak7',  icon: '💪', label: 'Week Warrior',  desc: '7 consecutive days',         earned: streak >= 7 },
    { id: 'streak30', icon: '🏆', label: 'Month Master',  desc: '30 consecutive days',        earned: streak >= 30 },
    { id: 'on_target',icon: '🎯', label: 'On Target',     desc: 'Hit calorie goal ±10%',     earned: loggedToday && calPct >= 0.9 && calPct <= 1.1 },
    { id: 'protein',  icon: '⚡', label: 'Protein Pro',   desc: 'Hit protein goal today',    earned: loggedToday && protPct >= 0.9 },
  ]
}

// ─── Add Meal Modal ─────────────────────────────────────────────

function AddMealModal({
  onSave, onClose,
}: {
  onSave: (log: Omit<NutritionLog, 'id' | 'log_date'>) => Promise<void>
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<string>('image/jpeg')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null)
  const [result, setResult]       = useState<NutritionEstimate | null>(null)
  const [mealType, setMealType]   = useState<typeof MEAL_TYPES[number]>('meal' as typeof MEAL_TYPES[number])
  const [saving, setSaving]       = useState(false)

  // Editable fields after analysis
  const [foodName, setFoodName]   = useState('')
  const [calories, setCalories]   = useState('')
  const [protein, setProtein]     = useState('')
  const [carbs, setCarbs]         = useState('')
  const [fiber, setFiber]         = useState('')
  const [fat, setFat]             = useState('')
  const [notes, setNotes]         = useState('')

  function fillFields(r: NutritionEstimate) {
    setFoodName(r.food_name)
    setCalories(String(r.calories))
    setProtein(String(r.protein_g))
    setCarbs(String(r.carbs_g))
    setFiber(String(r.fiber_g))
    setFat(String(r.fat_g))
    setNotes(r.notes ?? '')
  }

  function handleFile(file: File) {
    setMediaType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    setResult(null)
    setAnalyzeErr(null)
  }

  async function analyze() {
    if (!preview) return
    setAnalyzing(true)
    setAnalyzeErr(null)
    try {
      const base64 = preview.split(',')[1]
      const res = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Analysis failed')
      }
      const data: NutritionEstimate = await res.json()
      setResult(data)
      fillFields(data)
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    if (!foodName.trim() || !calories) return
    setSaving(true)
    await onSave({
      meal_type: mealType as NutritionLog['meal_type'],
      food_name: foodName.trim(),
      calories:  Math.round(Number(calories) || 0),
      protein_g: Number(protein) || 0,
      carbs_g:   Number(carbs)   || 0,
      fiber_g:   Number(fiber)   || 0,
      fat_g:     Number(fat)     || 0,
      notes:     notes.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  const autoMealType = (() => {
    const h = new Date().getHours()
    if (h < 10) return 'breakfast'
    if (h < 14) return 'lunch'
    if (h < 20) return 'dinner'
    return 'snack'
  })()

  // Pre-select meal type by time of day
  useEffect(() => {
    setMealType(autoMealType as typeof MEAL_TYPES[number])
  }, [autoMealType])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Log a Meal</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        {/* Image upload area */}
        <div
          onClick={() => fileRef.current?.click()}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden',
            preview ? 'border-white/20 h-44' : 'border-white/10 hover:border-violet-500/50 h-32'
          )}
        >
          {preview ? (
            <img src={preview} alt="food" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Camera className="h-8 w-8" />
              <span className="text-xs">Tap to upload a photo of your meal</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* Analyze button */}
        {preview && !result && (
          <Button
            onClick={analyze}
            disabled={analyzing}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          >
            {analyzing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</>
              : <><Zap className="mr-2 h-4 w-4" /> Analyze with AI</>
            }
          </Button>
        )}

        {analyzeErr && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {analyzeErr}
          </div>
        )}

        {/* Editable fields — shown after analysis OR always if no image */}
        {(result || !preview) && (
          <div className="space-y-3">
            {result && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                AI estimate ready — adjust values if needed
              </div>
            )}

            {/* Meal type */}
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setMealType(t)}
                  className={cn(
                    'rounded-lg border py-1.5 text-xs font-medium capitalize transition-all',
                    mealType === t
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}>
                  {MEAL_ICONS[t]} {t}
                </button>
              ))}
            </div>

            {/* Food name */}
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Food / Dish</Label>
              <input
                value={foodName}
                onChange={e => setFoodName(e.target.value)}
                placeholder="e.g. Chicken biryani"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Macro grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Calories (kcal)', val: calories, set: setCalories, key: 'cal' },
                { label: 'Protein (g)',     val: protein,  set: setProtein,  key: 'p'   },
                { label: 'Carbs (g)',       val: carbs,    set: setCarbs,    key: 'c'   },
                { label: 'Fiber (g)',       val: fiber,    set: setFiber,    key: 'f'   },
                { label: 'Fat (g)',         val: fat,      set: setFat,      key: 'fat' },
              ].map(({ label, val, set, key }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-slate-500 text-[10px]">{label}</Label>
                  <input
                    type="number" min={0}
                    value={val}
                    onChange={e => set(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              ))}
            </div>

            {result?.notes && (
              <p className="text-[10px] text-slate-600 italic">{result.notes}</p>
            )}
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !foodName.trim() || !calories}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Meal
        </Button>
      </div>
    </div>
  )
}

// ─── Main NutritionTracker ──────────────────────────────────────

export default function NutritionTracker() {
  const [todayLogs, setTodayLogs]   = useState<NutritionLog[]>([])
  const [allDates, setAllDates]     = useState<string[]>([])
  const [goals, setGoals]           = useState<Goals>(DEFAULT_GOALS)
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [prevBadgeCount, setPrevBadgeCount] = useState(0)
  const [newBadgeFlash, setNewBadgeFlash]   = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }

    const today = todayStr()
    const [logsRes, datesRes, goalsRes] = await Promise.all([
      supabase
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('log_date', today)
        .order('created_at', { ascending: true }),
      supabase
        .from('nutrition_logs')
        .select('log_date')
        .eq('user_id', session.user.id),
      supabase
        .from('nutrition_goals')
        .select('*')
        .eq('user_id', session.user.id)
        .single(),
    ])

    setTodayLogs((logsRes.data as NutritionLog[]) ?? [])
    setAllDates((datesRes.data ?? []).map((r: { log_date: string }) => r.log_date))
    if (goalsRes.data) {
      setGoals({
        calories:  goalsRes.data.calories,
        protein_g: goalsRes.data.protein_g,
        carbs_g:   goalsRes.data.carbs_g,
        fiber_g:   goalsRes.data.fiber_g,
        fat_g:     goalsRes.data.fat_g,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveLog(entry: Omit<NutritionLog, 'id' | 'log_date'>) {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { data } = await supabase
      .from('nutrition_logs')
      .insert({ ...entry, user_id: session.user.id, log_date: todayStr() })
      .select()
      .single()
    if (data) {
      setTodayLogs(prev => [...prev, data as NutritionLog])
      const newDates = [...allDates, todayStr()]
      setAllDates(newDates)
    }
  }

  async function deleteLog(id: string) {
    setDeletingId(id)
    setTodayLogs(prev => prev.filter(l => l.id !== id))
    const supabase = createSupabaseBrowserClient()
    await supabase.from('nutrition_logs').delete().eq('id', id)
    setDeletingId(null)
  }

  const today       = todayStr()
  const totals      = sumMacros(todayLogs)
  const streak      = computeStreak(allDates)
  const totalDays   = new Set(allDates).size
  const loggedToday = allDates.includes(today)
  const badges      = computeBadges(streak, totalDays, totals, goals, loggedToday)
  const earnedCount = badges.filter(b => b.earned).length

  // Flash animation when a new badge is earned
  useEffect(() => {
    if (earnedCount > prevBadgeCount && prevBadgeCount > 0) {
      setNewBadgeFlash(true)
      setTimeout(() => setNewBadgeFlash(false), 2000)
    }
    setPrevBadgeCount(earnedCount)
  }, [earnedCount]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Streak header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className={cn('h-5 w-5', streak > 0 ? 'text-orange-400' : 'text-slate-600')} />
          <span className="text-sm font-semibold text-white">
            {streak > 0 ? `${streak}-day streak` : 'Start your streak'}
          </span>
          {loggedToday && (
            <span className="text-[10px] rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-emerald-400 font-medium">
              Logged today ✓
            </span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Log Meal
        </button>
      </div>

      {/* Today's calorie + macro overview */}
      <div className="rounded-xl border border-white/10 bg-white/3 p-4">
        <div className="flex items-center gap-6">
          <CalorieRing consumed={totals.calories} goal={goals.calories} />
          <div className="flex-1 space-y-2.5">
            <MacroBar label="Protein" value={totals.protein_g} goal={goals.protein_g} unit="g" color="bg-sky-500" />
            <MacroBar label="Carbs"   value={totals.carbs_g}   goal={goals.carbs_g}   unit="g" color="bg-amber-500" />
            <MacroBar label="Fiber"   value={totals.fiber_g}   goal={goals.fiber_g}   unit="g" color="bg-emerald-500" />
            <MacroBar label="Fat"     value={totals.fat_g}     goal={goals.fat_g}     unit="g" color="bg-rose-500" />
          </div>
        </div>
      </div>

      {/* Reward badges */}
      <div className={cn('space-y-2', newBadgeFlash && 'animate-pulse')}>
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rewards</span>
          <span className="text-xs text-slate-600">{earnedCount}/{badges.length} earned</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {badges.map(badge => <BadgeChip key={badge.id} badge={badge} />)}
        </div>
      </div>

      {/* Today's meals */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Meals</p>

        {todayLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 p-8 text-center">
            <Camera className="h-8 w-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No meals logged yet today.</p>
            <p className="text-xs text-slate-600 mt-1">Snap a photo of your meal to get started.</p>
          </div>
        ) : (
          todayLogs.map(log => (
            <div key={log.id}
              className="group flex items-start gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 hover:border-white/15 transition-all">
              <span className="text-lg leading-none mt-0.5">{MEAL_ICONS[log.meal_type] ?? '🍽️'}</span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{log.food_name}</p>
                  <span className="text-xs font-bold text-violet-300 shrink-0">{log.calories} kcal</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  <span>P: <span className="text-slate-400">{Number(log.protein_g).toFixed(1)}g</span></span>
                  <span>C: <span className="text-slate-400">{Number(log.carbs_g).toFixed(1)}g</span></span>
                  <span>F: <span className="text-slate-400">{Number(log.fiber_g).toFixed(1)}g</span></span>
                  <span>Fat: <span className="text-slate-400">{Number(log.fat_g).toFixed(1)}g</span></span>
                </div>
                {log.notes && <p className="text-[10px] text-slate-600 italic truncate">{log.notes}</p>}
              </div>
              <button
                onClick={() => deleteLog(log.id)}
                disabled={deletingId === log.id}
                className="mt-0.5 shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
              >
                {deletingId === log.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Goals footer */}
      <div className="rounded-xl border border-white/5 bg-white/2 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">Daily goals</span>
          <span className="text-xs text-slate-600">
            {goals.calories} kcal · {goals.protein_g}g protein · {goals.carbs_g}g carbs · {goals.fiber_g}g fiber · {goals.fat_g}g fat
          </span>
        </div>
      </div>

      {showModal && (
        <AddMealModal onSave={saveLog} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
