'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Camera, Loader2, Plus, Trash2, Flame, Trophy, Zap,
  CheckCircle2, AlertCircle, Save, RefreshCw, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────

interface NutritionLog {
  id: string
  log_date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fiber_g: number
  fat_g: number
  notes: string | null
}

interface Macros {
  calories: number; protein_g: number; carbs_g: number; fiber_g: number; fat_g: number
}

interface Goals extends Macros {}

interface NutritionEstimate extends Macros {
  food_name: string; notes: string
}

interface BodyStats {
  height_cm: number; age: number; target_weight_kg: number | null
}

interface WeightLog { id: string; log_date: string; weight_kg: number }

interface Recommendation {
  title: string; description: string; priority: 'high' | 'medium' | 'low'
}

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_GOALS: Goals = { calories: 2000, protein_g: 150, carbs_g: 250, fiber_g: 30, fat_g: 65 }

const MEAL_TYPES  = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const MEAL_ICONS: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }

// ─── Utilities ────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }

function sumMacros(logs: NutritionLog[]): Macros {
  return logs.reduce(
    (a, l) => ({ calories: a.calories + l.calories, protein_g: a.protein_g + +l.protein_g,
                  carbs_g: a.carbs_g + +l.carbs_g, fiber_g: a.fiber_g + +l.fiber_g, fat_g: a.fat_g + +l.fat_g }),
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
  const cursor = new Date(sorted[0])
  for (const d of sorted) {
    if (d === cursor.toISOString().split('T')[0]) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else break
  }
  return streak
}

function bmi(weightKg: number, heightCm: number) {
  const h = heightCm / 100
  return +(weightKg / (h * h)).toFixed(1)
}

function bmiCategory(b: number): { label: string; color: string } {
  if (b < 18.5) return { label: 'Underweight', color: 'text-sky-400' }
  if (b < 25)   return { label: 'Normal',      color: 'text-emerald-400' }
  if (b < 30)   return { label: 'Overweight',  color: 'text-amber-400' }
  return           { label: 'Obese',        color: 'text-red-400' }
}

// Resize image on a canvas before sending to API (fixes 413 errors from large phone photos)
async function resizeImage(
  dataUrl: string, maxPx = 1024, quality = 0.82
): Promise<{ base64: string; mediaType: string }> {
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

function pct(v: number, g: number) { return Math.min(100, Math.round((v / g) * 100)) }

// ─── Subcomponents ────────────────────────────────────────────

function MacroBar({ label, value, goal, unit, color }: {
  label: string; value: number; goal: number; unit: string; color: string
}) {
  const p = pct(value, goal)
  const bar = p > 110 ? 'bg-red-500' : p > 90 ? 'bg-emerald-500' : color
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 tabular-nums">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          <span className="text-slate-600">/{goal}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', bar)} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const r = 54; const circ = 2 * Math.PI * r
  const p = Math.min(1, consumed / goal)
  const offset = circ * (1 - p)
  const over = consumed > goal * 1.1
  const ringColor = over ? 'text-red-400' : p > 0.9 ? 'text-emerald-400' : 'text-violet-400'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width="130" height="130" className="-rotate-90">
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          <circle cx="65" cy="65" r={r} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className={cn('transition-all duration-700', ringColor)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white tabular-nums leading-none">{consumed}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">kcal</span>
        </div>
      </div>
      <span className="text-xs text-slate-500">
        {goal - consumed > 0 ? `${goal - consumed} remaining` : `${consumed - goal} over`}
      </span>
    </div>
  )
}

function BMIGauge({ bmiVal }: { bmiVal: number }) {
  const { label, color } = bmiCategory(bmiVal)
  // Gauge: 15–40 range mapped to 0–100%
  const pos = Math.min(100, Math.max(0, ((bmiVal - 15) / 25) * 100))
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-4xl font-bold text-white tabular-nums">{bmiVal}</span>
        <span className={cn('text-sm font-semibold mb-1', color)}>{label}</span>
      </div>
      {/* Gradient bar */}
      <div className="relative h-3 w-full rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(to right, #38bdf8 0%, #34d399 30%, #fbbf24 60%, #f87171 85%)' }}>
        {/* Marker */}
        <div className="absolute top-0 h-full w-0.5 bg-white shadow"
          style={{ left: `${pos}%`, transform: 'translateX(-50%)' }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>Under 18.5</span><span>Normal 25</span><span>Over 30</span>
      </div>
    </div>
  )
}

interface BadgeItem { id: string; icon: string; label: string; earned: boolean }

function computeBadges(streak: number, totalDays: number, totals: Macros, goals: Goals, loggedToday: boolean): BadgeItem[] {
  const calPct = totals.calories / goals.calories
  return [
    { id: 'first',     icon: '🌱', label: 'First Log',    earned: totalDays >= 1 },
    { id: 'streak3',   icon: '🔥', label: '3-Day Streak', earned: streak >= 3 },
    { id: 'streak7',   icon: '💪', label: 'Week Warrior', earned: streak >= 7 },
    { id: 'streak30',  icon: '🏆', label: 'Month Master', earned: streak >= 30 },
    { id: 'on_target', icon: '🎯', label: 'On Target',    earned: loggedToday && calPct >= 0.9 && calPct <= 1.1 },
    { id: 'protein',   icon: '⚡', label: 'Protein Pro',  earned: loggedToday && totals.protein_g / goals.protein_g >= 0.9 },
  ]
}

// ─── Add Meal Modal ────────────────────────────────────────────

function AddMealModal({ onSave, onClose }: {
  onSave: (log: Omit<NutritionLog, 'id' | 'log_date'>) => Promise<void>
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]         = useState<string | null>(null)
  const [analyzing, setAnalyzing]     = useState(false)
  const [analyzeErr, setAnalyzeErr]   = useState<string | null>(null)
  const [result, setResult]           = useState<NutritionEstimate | null>(null)
  const [mealType, setMealType]       = useState<typeof MEAL_TYPES[number]>('snack')
  const [saving, setSaving]           = useState(false)
  const [foodName, setFoodName]       = useState('')
  const [calories, setCalories]       = useState('')
  const [protein, setProtein]         = useState('')
  const [carbs, setCarbs]             = useState('')
  const [fiber, setFiber]             = useState('')
  const [fat, setFat]                 = useState('')
  const [notes, setNotes]             = useState('')
  const [autofilling, setAutofilling] = useState(false)
  const [autofillErr, setAutofillErr] = useState<string | null>(null)

  useEffect(() => {
    const h = new Date().getHours()
    setMealType(h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 20 ? 'dinner' : 'snack')
  }, [])

  function fillFields(r: NutritionEstimate) {
    setFoodName(r.food_name); setCalories(String(r.calories))
    setProtein(String(r.protein_g)); setCarbs(String(r.carbs_g))
    setFiber(String(r.fiber_g)); setFat(String(r.fat_g)); setNotes(r.notes ?? '')
  }

  async function autofill() {
    if (!foodName.trim() || autofilling) return
    setAutofilling(true); setAutofillErr(null)
    try {
      const res  = await fetch('/api/nutrition/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodName: foodName.trim() }),
      })
      const text = await res.text()
      let data: NutritionEstimate
      try { data = JSON.parse(text) } catch {
        throw new Error(res.ok ? 'Unexpected server response' : `Server error ${res.status}`)
      }
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Autofill failed')
      setResult(data); fillFields(data)
    } catch (e) {
      setAutofillErr(e instanceof Error ? e.message : 'Autofill failed')
    } finally { setAutofilling(false) }
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => { setPreview(e.target?.result as string); setResult(null); setAnalyzeErr(null) }
    reader.readAsDataURL(file)
  }

  async function analyze() {
    if (!preview) return
    setAnalyzing(true); setAnalyzeErr(null)
    try {
      // Resize before sending — prevents 413 errors from large phone photos
      const { base64, mediaType } = await resizeImage(preview)
      const res = await fetch('/api/nutrition/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mediaType }),
      })
      // Read as text first so non-JSON errors don't throw a cryptic parse error
      const text = await res.text()
      let data: NutritionEstimate
      try { data = JSON.parse(text) } catch {
        throw new Error(res.ok ? 'Unexpected response from server' : `Server error ${res.status}`)
      }
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Analysis failed')
      setResult(data); fillFields(data)
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : 'Analysis failed')
    } finally { setAnalyzing(false) }
  }

  async function handleSave() {
    if (!foodName.trim() || !calories) return
    setSaving(true)
    await onSave({
      meal_type: mealType, food_name: foodName.trim(),
      calories: Math.round(Number(calories) || 0),
      protein_g: Number(protein) || 0, carbs_g: Number(carbs) || 0,
      fiber_g:   Number(fiber)   || 0, fat_g:   Number(fat)   || 0,
      notes: notes.trim() || null,
    })
    setSaving(false); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Log a Meal</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Image drop zone */}
        <div onClick={() => fileRef.current?.click()}
          className={cn('relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-all',
            preview ? 'border-white/20 h-44' : 'border-white/10 hover:border-violet-500/50 h-32')}>
          {preview
            ? <img src={preview} alt="food" className="h-full w-full object-cover" />
            : <div className="flex flex-col items-center gap-2 text-slate-500">
                <Camera className="h-8 w-8" />
                <span className="text-xs">Tap to take / upload a photo</span>
              </div>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {preview && !result && (
          <Button onClick={analyze} disabled={analyzing} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analysing…</>
                       : <><Zap className="mr-2 h-4 w-4" /> Analyse with AI</>}
          </Button>
        )}

        {analyzeErr && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{analyzeErr}
          </div>
        )}

        {(result || !preview) && (
          <div className="space-y-3">
            {result && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> AI estimate ready — adjust if needed
              </div>
            )}
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setMealType(t)}
                  className={cn('rounded-lg border py-1.5 text-xs font-medium capitalize transition-all',
                    mealType === t ? 'border-violet-500 bg-violet-500/20 text-white'
                                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20')}>
                  {MEAL_ICONS[t]} {t}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-slate-400 text-xs">Food / Dish</Label>
                <span className="text-[10px] text-slate-600">Type a meal name → hit ✨ to auto-fill macros</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={foodName}
                  onChange={e => { setFoodName(e.target.value); setAutofillErr(null) }}
                  onKeyDown={e => { if (e.key === 'Enter' && foodName.trim().length >= 3) autofill() }}
                  placeholder="e.g. bowl of rice with chicken"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={autofill}
                  disabled={autofilling || !foodName.trim()}
                  title="Auto-fill macros with AI"
                  className={cn(
                    'shrink-0 flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                    autofilling
                      ? 'border-violet-500/30 bg-violet-500/10 text-violet-400'
                      : foodName.trim()
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25'
                        : 'border-white/10 bg-white/5 text-slate-600 cursor-not-allowed'
                  )}
                >
                  {autofilling
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5" />}
                </button>
              </div>
              {autofillErr && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />{autofillErr}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['Calories (kcal)', calories, setCalories], ['Protein (g)', protein, setProtein],
                ['Carbs (g)',   carbs,   setCarbs  ], ['Fiber (g)',  fiber,  setFiber  ],
                ['Fat (g)',     fat,     setFat    ]].map(([label, val, set]) => (
                <div key={label as string} className="space-y-1">
                  <Label className="text-slate-500 text-[10px]">{label as string}</Label>
                  <input type="number" min={0} value={val as string}
                    onChange={e => (set as (v: string) => void)(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500" />
                </div>
              ))}
            </div>
            {result?.notes && <p className="text-[10px] text-slate-600 italic">{result.notes}</p>}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving || !foodName.trim() || !calories}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Meal
        </Button>
      </div>
    </div>
  )
}

// ─── Body & BMI tab ────────────────────────────────────────────

function BodyTab({ userId }: { userId: string }) {
  const [stats, setStats]         = useState<BodyStats>({ height_cm: 170, age: 25, target_weight_kg: null })
  const [weightKg, setWeightKg]   = useState('')
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient()
      const [statsRes, wRes] = await Promise.all([
        supabase.from('body_stats').select('*').eq('user_id', userId).single(),
        supabase.from('weight_logs').select('*').eq('user_id', userId)
          .order('log_date', { ascending: true }).limit(60),
      ])
      if (statsRes.data) setStats(statsRes.data as BodyStats)
      setWeightLogs((wRes.data as WeightLog[]) ?? [])
      setLoading(false)
    }
    load()
  }, [userId])

  async function saveStats() {
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('body_stats').upsert({
      user_id: userId, ...stats, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (weightKg && Number(weightKg) > 0) {
      await supabase.from('weight_logs').upsert({
        user_id: userId, log_date: todayStr(), weight_kg: Number(weightKg),
      }, { onConflict: 'user_id,log_date' })
      setWeightLogs(prev => {
        const filtered = prev.filter(w => w.log_date !== todayStr())
        return [...filtered, { id: 'temp', log_date: todayStr(), weight_kg: Number(weightKg) }]
          .sort((a, b) => a.log_date.localeCompare(b.log_date))
      })
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const latestWeight = weightLogs.length > 0 ? Number(weightLogs[weightLogs.length - 1].weight_kg) : null
  const currentBMI   = latestWeight && stats.height_cm ? bmi(latestWeight, stats.height_cm) : null

  const chartData = weightLogs.map(w => ({
    date:   w.log_date.slice(5), // MM-DD
    weight: Number(w.weight_kg),
  }))

  const yMin = chartData.length > 0 ? Math.floor(Math.min(...chartData.map(d => d.weight)) - 2) : 50
  const yMax = chartData.length > 0 ? Math.ceil(Math.max(...chartData.map(d => d.weight)) + 2)  : 100

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>

  return (
    <div className="space-y-5">
      {/* BMI display */}
      {currentBMI && (
        <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your BMI</p>
          <BMIGauge bmiVal={currentBMI} />
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              ['Height', `${stats.height_cm} cm`],
              ['Weight', `${latestWeight} kg`],
              ['Age',    `${stats.age} yrs`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-white/5 px-3 py-2 text-center">
                <p className="text-[10px] text-slate-500">{l}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input form */}
      <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Update Stats</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Height (cm)', val: String(stats.height_cm), set: (v: string) => setStats(s => ({ ...s, height_cm: Number(v) })) },
            { label: 'Age',         val: String(stats.age),        set: (v: string) => setStats(s => ({ ...s, age: Number(v) })) },
            { label: "Today's weight (kg)", val: weightKg, set: setWeightKg },
            { label: 'Target weight (kg)',  val: String(stats.target_weight_kg ?? ''), set: (v: string) => setStats(s => ({ ...s, target_weight_kg: v ? Number(v) : null })) },
          ].map(({ label, val, set }) => (
            <div key={label} className="space-y-1">
              <Label className="text-slate-400 text-xs">{label}</Label>
              <input type="number" min={0} value={val} onChange={e => set(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
            </div>
          ))}
        </div>
        <Button onClick={saveStats} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2">
          {saving  ? <Loader2 className="h-4 w-4 animate-spin" />
          : saved   ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          :           <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save Stats'}
        </Button>
      </div>

      {/* Weight graph */}
      {chartData.length > 1 && (
        <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Weight History</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[yMin, yMax]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#a78bfa' }}
                formatter={(v: number) => [`${v} kg`, 'Weight']}
              />
              {stats.target_weight_kg && (
                <ReferenceLine y={stats.target_weight_kg} stroke="#34d399" strokeDasharray="4 2"
                  label={{ value: `Goal ${stats.target_weight_kg}kg`, fill: '#34d399', fontSize: 10 }} />
              )}
              <Line type="monotone" dataKey="weight" stroke="#a78bfa" strokeWidth={2}
                dot={{ fill: '#a78bfa', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
          {stats.target_weight_kg && latestWeight && (
            <p className="text-xs text-center text-slate-500">
              {latestWeight > stats.target_weight_kg
                ? `${(latestWeight - stats.target_weight_kg).toFixed(1)} kg to goal`
                : '🎉 Goal weight reached!'}
            </p>
          )}
        </div>
      )}

      {chartData.length <= 1 && (
        <p className="text-xs text-slate-600 text-center py-2">Log your weight daily to see progress graph</p>
      )}
    </div>
  )
}

// ─── AI Insights tab ──────────────────────────────────────────

function InsightsTab() {
  const [loading, setLoading]   = useState(false)
  const [summary, setSummary]   = useState<string | null>(null)
  const [recs, setRecs]         = useState<Recommendation[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [fetched, setFetched]   = useState(false)

  async function fetchInsights() {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/nutrition/insights')
      const text = await res.text()
      let data: { summary?: string; recommendations?: Recommendation[]; error?: string }
      try { data = JSON.parse(text) } catch { throw new Error('Unexpected server response') }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load insights')
      setSummary(data.summary ?? null)
      setRecs(data.recommendations ?? [])
      setFetched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setLoading(false) }
  }

  const PRIORITY_STYLE: Record<string, string> = {
    high:   'border-red-500/30 bg-red-500/8 text-red-400',
    medium: 'border-amber-500/30 bg-amber-500/8 text-amber-400',
    low:    'border-emerald-500/30 bg-emerald-500/8 text-emerald-400',
  }

  return (
    <div className="space-y-4">
      {!fetched ? (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 text-center space-y-3">
          <Zap className="h-8 w-8 text-violet-400 mx-auto" />
          <p className="text-sm text-white font-medium">AI Nutrition Insights</p>
          <p className="text-xs text-slate-400">Analyses your last 14 days of meals and gives personalised recommendations based on your goals and body stats.</p>
          <Button onClick={fetchInsights} disabled={loading} className="bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analysing…</> : 'Get My Insights'}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Insights</p>
            <button onClick={fetchInsights} disabled={loading}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors">
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Refresh
            </button>
          </div>

          {summary && (
            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
            </div>
          )}

          <div className="space-y-3">
            {recs.map((r, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border', PRIORITY_STYLE[r.priority] ?? PRIORITY_STYLE.low)}>
                    {r.priority}
                  </span>
                  <p className="text-sm font-semibold text-white">{r.title}</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{r.description}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}
    </div>
  )
}

// ─── Main NutritionTracker ─────────────────────────────────────

type SubTab = 'today' | 'body' | 'insights'

export default function NutritionTracker() {
  const [subTab, setSubTab]         = useState<SubTab>('today')
  const [todayLogs, setTodayLogs]   = useState<NutritionLog[]>([])
  const [allDates, setAllDates]     = useState<string[]>([])
  const [goals]                     = useState<Goals>(DEFAULT_GOALS)
  const [userId, setUserId]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    setUserId(session.user.id)
    const today = todayStr()
    const [logsRes, datesRes] = await Promise.all([
      supabase.from('nutrition_logs').select('*').eq('user_id', session.user.id)
        .eq('log_date', today).order('created_at', { ascending: true }),
      supabase.from('nutrition_logs').select('log_date').eq('user_id', session.user.id),
    ])
    setTodayLogs((logsRes.data as NutritionLog[]) ?? [])
    setAllDates(((datesRes.data ?? []) as { log_date: string }[]).map(r => r.log_date))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveLog(entry: Omit<NutritionLog, 'id' | 'log_date'>) {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { data } = await supabase.from('nutrition_logs')
      .insert({ ...entry, user_id: session.user.id, log_date: todayStr() })
      .select().single()
    if (data) {
      setTodayLogs(prev => [...prev, data as NutritionLog])
      setAllDates(prev => [...prev, todayStr()])
    }
  }

  async function deleteLog(id: string) {
    setDeletingId(id)
    setTodayLogs(prev => prev.filter(l => l.id !== id))
    const supabase = createSupabaseBrowserClient()
    await supabase.from('nutrition_logs').delete().eq('id', id)
    setDeletingId(null)
  }

  const totals      = sumMacros(todayLogs)
  const streak      = computeStreak(allDates)
  const totalDays   = new Set(allDates).size
  const loggedToday = allDates.includes(todayStr())
  const badges      = computeBadges(streak, totalDays, totals, goals, loggedToday)
  const earned      = badges.filter(b => b.earned).length

  const SUBTABS: { id: SubTab; label: string }[] = [
    { id: 'today',    label: 'Today' },
    { id: 'body',     label: 'Body & BMI' },
    { id: 'insights', label: 'AI Insights' },
  ]

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/3 p-1">
        {SUBTABS.map(t => (
          <button key={t.id} type="button" onClick={() => setSubTab(t.id)}
            className={cn('flex-1 rounded-md py-1.5 text-xs font-medium transition-all',
              subTab === t.id ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Today tab ── */}
      {subTab === 'today' && (
        <div className="space-y-5">
          {/* Streak + Log button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className={cn('h-5 w-5', streak > 0 ? 'text-orange-400' : 'text-slate-600')} />
              <span className="text-sm font-semibold text-white">
                {streak > 0 ? `${streak}-day streak` : 'Start your streak'}
              </span>
              {loggedToday && (
                <span className="text-[10px] rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-emerald-400 font-medium">
                  Logged ✓
                </span>
              )}
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
              <Plus className="h-3.5 w-3.5" /> Log Meal
            </button>
          </div>

          {/* Calorie ring + macro bars */}
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

          {/* Badges */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rewards</span>
              <span className="text-xs text-slate-600">{earned}/{badges.length} earned</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {badges.map(b => (
                <div key={b.id} className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 min-w-[72px] transition-all',
                  b.earned ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/5 bg-white/3 opacity-40 grayscale'
                )}>
                  <span className="text-xl leading-none">{b.icon}</span>
                  <span className={cn('text-[10px] font-semibold leading-tight text-center', b.earned ? 'text-amber-300' : 'text-slate-500')}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meals list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Meals</p>
            {todayLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/8 p-8 text-center">
                <Camera className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No meals logged yet.</p>
                <p className="text-xs text-slate-600 mt-1">Type a meal name and let AI fill in the macros.</p>
              </div>
            ) : todayLogs.map(log => (
              <div key={log.id}
                className="group flex items-start gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 hover:border-white/15 transition-all">
                <span className="text-lg leading-none mt-0.5">{MEAL_ICONS[log.meal_type] ?? '🍽️'}</span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white truncate">{log.food_name}</p>
                    <span className="text-xs font-bold text-violet-300 shrink-0">{log.calories} kcal</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span>P: <span className="text-slate-400">{(+log.protein_g).toFixed(1)}g</span></span>
                    <span>C: <span className="text-slate-400">{(+log.carbs_g).toFixed(1)}g</span></span>
                    <span>Fiber: <span className="text-slate-400">{(+log.fiber_g).toFixed(1)}g</span></span>
                    <span>Fat: <span className="text-slate-400">{(+log.fat_g).toFixed(1)}g</span></span>
                  </div>
                  {log.notes && <p className="text-[10px] text-slate-600 italic truncate">{log.notes}</p>}
                </div>
                <button onClick={() => deleteLog(log.id)} disabled={deletingId === log.id}
                  className="mt-0.5 shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
                  {deletingId === log.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/5 bg-white/2 px-4 py-2.5">
            <span className="text-xs text-slate-600">
              Daily goals: {goals.calories} kcal · {goals.protein_g}g P · {goals.carbs_g}g C · {goals.fiber_g}g Fiber · {goals.fat_g}g Fat
            </span>
          </div>
        </div>
      )}

      {/* ── Body & BMI tab ── */}
      {subTab === 'body' && userId && <BodyTab userId={userId} />}

      {/* ── AI Insights tab ── */}
      {subTab === 'insights' && <InsightsTab />}

      {showModal && <AddMealModal onSave={saveLog} onClose={() => setShowModal(false)} />}
    </div>
  )
}
