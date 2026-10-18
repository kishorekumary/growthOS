'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, ClipboardList, Loader2, Mic, Undo2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/effects'
import { todayStr } from '@/lib/habitStreak'
import { averageClock, topRepeats, usualWorkout } from '@/lib/logDefaults'
import { arrangeTiles, hoursBetween, mealTypeFor, tileOrder, type TodayTile } from '@/lib/todayLog'

// The Quick Log home: one tile per thing worth logging today, each showing
// whether it's done and logging with a single tap. "More" opens the full
// form (the existing Quick Log panels) for anything unusual.

export type DetailPanel = 'plans' | 'voice' | 'meal' | 'workout' | 'finance' | 'journal' | 'task' | 'sleep'

const WATER_GOAL_ML = 4000
const WORKOUT_META: Record<string, { icon: string; label: string }> = {
  cardio: { icon: '🏃', label: 'Cardio' }, strength: { icon: '💪', label: 'Strength' },
  yoga: { icon: '🧘', label: 'Yoga' }, sports: { icon: '⚽', label: 'Sports' }, rest: { icon: '😴', label: 'Rest day' },
}
const MOODS = ['😔', '😕', '😐', '🙂', '😊'] as const
const MOOD_LABELS = ['Rough', 'Low', 'Okay', 'Good', 'Great'] as const
const FEELINGS = ['Calm', 'Grateful', 'Focused', 'Happy', 'Tired', 'Stressed', 'Anxious', 'Energized'] as const
const QUALITY = ['Poor', 'Fair', 'Good', 'Great', 'Perfect'] as const

interface Meal { food_name: string; calories: number; protein_g: number; carbs_g: number; fiber_g: number; fat_g: number }
interface Spend { category: string; amount: number; description: string | null }

interface TodayState {
  uid: string
  waterMl: number
  mood: { mood: number; energy: number; word: string | null } | null
  sleep: { bedtime: string; wake_time: string; quality: number | null } | null
  usualSleep: { bedtime: string; wake_time: string } | null
  workouts: { workout_type: string; duration_mins: number }[]
  usualWorkout: { workout_type: string; duration_mins: number } | null
  meals: { calories: number }[]
  recentMeals: Meal[]
  spentToday: number
  frequentSpends: Spend[]
}

const fmtClock = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

async function loadToday(): Promise<TodayState | null> {
  const db = createSupabaseBrowserClient()
  const { data: { session } } = await db.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return null
  const today = todayStr()
  const since90 = new Date(); since90.setDate(since90.getDate() - 90)

  const [water, mood, sleeps, workouts, meals, recentMeals, spentToday, spends] = await Promise.all([
    db.from('water_logs').select('amount_ml').eq('user_id', uid).eq('log_date', today),
    db.from('mood_checkins').select('mood, energy, word').eq('user_id', uid).eq('checked_at', today).maybeSingle(),
    db.from('sleep_logs').select('sleep_date, bedtime, wake_time, quality').eq('user_id', uid).order('sleep_date', { ascending: false }).limit(14),
    db.from('workout_logs').select('log_date, workout_type, duration_mins').eq('user_id', uid).order('log_date', { ascending: false }).limit(30),
    db.from('nutrition_logs').select('calories').eq('user_id', uid).eq('log_date', today),
    db.from('nutrition_logs').select('food_name, calories, protein_g, carbs_g, fiber_g, fat_g').eq('user_id', uid).order('logged_at', { ascending: false }).limit(150),
    db.from('transactions').select('amount').eq('user_id', uid).eq('type', 'expense').eq('txn_date', today),
    db.from('transactions').select('category, amount, description').eq('user_id', uid).eq('type', 'expense')
      .gte('txn_date', since90.toISOString().slice(0, 10)).order('txn_date', { ascending: false }).limit(300),
  ])

  const sleepRows = sleeps.data ?? []
  const todaySleep = sleepRows.find(r => r.sleep_date === today)
  const b = averageClock(sleepRows.map(r => r.bedtime)), w = averageClock(sleepRows.map(r => r.wake_time))
  const workoutRows = workouts.data ?? []

  return {
    uid,
    waterMl: (water.data ?? []).reduce((s, r) => s + (r.amount_ml ?? 0), 0),
    mood: mood.data ?? null,
    sleep: todaySleep?.bedtime && todaySleep.wake_time
      ? { bedtime: todaySleep.bedtime.slice(0, 5), wake_time: todaySleep.wake_time.slice(0, 5), quality: todaySleep.quality }
      : null,
    usualSleep: b && w ? { bedtime: b, wake_time: w } : { bedtime: '23:00', wake_time: '06:30' },
    workouts: workoutRows.filter(r => r.log_date === today).map(r => ({ workout_type: r.workout_type, duration_mins: r.duration_mins ?? 0 })),
    usualWorkout: usualWorkout(workoutRows),
    meals: meals.data ?? [],
    recentMeals: topRepeats(recentMeals.data ?? [], r => r.food_name.trim().toLowerCase(), 6)
      .map(r => ({ ...r, protein_g: r.protein_g ?? 0, carbs_g: r.carbs_g ?? 0, fiber_g: r.fiber_g ?? 0, fat_g: r.fat_g ?? 0 })),
    spentToday: (spentToday.data ?? []).reduce((s, r) => s + Number(r.amount), 0),
    frequentSpends: topRepeats(spends.data ?? [], r => `${r.category}|${Number(r.amount)}|${(r.description ?? '').trim().toLowerCase()}`, 6)
      .map(r => ({ ...r, amount: Number(r.amount) })),
  }
}

// ─── Tile shell ──────────────────────────────────────────────────

function Tile({ icon, title, status, done, tone, onMore, children }: {
  icon: string; title: string; status: React.ReactNode; done: boolean
  tone: string; onMore?: () => void; children?: React.ReactNode
}) {
  return (
    <div className={cn('rounded-2xl border p-3.5 transition-colors', done ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : tone)}>
      <div className="flex items-center gap-2.5">
        <span className="text-xl leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
            {title}
            {done && <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} />}
          </p>
          <p className="truncate text-[11px] text-slate-400">{status}</p>
        </div>
        {onMore && (
          <button type="button" onClick={onMore} className="flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:bg-white/5 hover:text-white">
            More <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  )
}

function TapChip({ onClick, disabled, children, className }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 disabled:opacity-50', className)}>
      {children}
    </button>
  )
}

// ─── Main ────────────────────────────────────────────────────────

export default function TodayLog({ onOpen }: { onOpen: (panel: DetailPanel) => void }) {
  const [state, setState] = useState<TodayState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    const s = await loadToday().catch(() => null)
    setState(s); setLoaded(true)
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])

  // Every one-tap write: mark busy, write, refresh, offer Undo for 5s.
  async function tap(key: string, label: string, write: () => Promise<(() => Promise<void>) | null>) {
    if (busy) return
    setBusy(key)
    try {
      const revert = await write()
      haptic('tick')
      if (revert) {
        if (undoTimer.current) clearTimeout(undoTimer.current)
        setUndo({ label, run: revert })
        undoTimer.current = setTimeout(() => setUndo(null), 5000)
      }
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  async function runUndo() {
    if (!undo) return
    const u = undo
    setUndo(null)
    await u.run()
    await refresh()
  }

  if (!loaded) return (
    <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
  )
  if (!state) return <p className="py-8 text-center text-sm text-slate-400">Sign in to log your day.</p>

  const db = createSupabaseBrowserClient()
  const s = state
  const today = todayStr()
  const insertReturningId = async (table: string, row: Record<string, unknown>) => {
    const { data } = await db.from(table).insert(row).select('id').single()
    return data?.id as string | undefined
  }
  const deleteById = (table: string, id?: string) => async () => { if (id) await db.from(table).delete().eq('id', id) }

  const done = new Set<TodayTile>()
  if (s.sleep) done.add('sleep')
  if (s.mood) done.add('mood')
  if (s.waterMl >= WATER_GOAL_ML) done.add('water')
  if (s.workouts.length) done.add('workout')
  if (s.meals.length) done.add('meal')
  if (s.spentToday > 0) done.add('spend')
  const tiles = arrangeTiles(tileOrder(new Date().getHours()), done)

  const tileFor = (t: TodayTile) => {
    switch (t) {
      case 'water': {
        const pct = Math.min(100, Math.round((s.waterMl / WATER_GOAL_ML) * 100))
        return (
          <Tile key={t} icon="💧" title="Water" done={done.has(t)} tone="border-sky-500/20 bg-sky-500/[0.05]"
            status={`${s.waterMl.toLocaleString()} / ${WATER_GOAL_ML.toLocaleString()} ml`} onMore={() => onOpen('meal')}>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-1.5">
              {[250, 500].map(ml => (
                <TapChip key={ml} disabled={!!busy} className="flex-1 border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                  onClick={() => tap(`water${ml}`, `+${ml} ml water`, async () => {
                    const id = await insertReturningId('water_logs', { user_id: s.uid, log_date: today, amount_ml: ml, logged_at: new Date().toISOString() })
                    return deleteById('water_logs', id)
                  })}>
                  {busy === `water${ml}` ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : `+${ml} ml`}
                </TapChip>
              ))}
            </div>
          </Tile>
        )
      }
      case 'mood': {
        const current = s.mood?.mood ?? 0
        const setMood = (mood: number, word: string | null) => tap(`mood${mood}${word}`, 'Mood', async () => {
          await db.from('mood_checkins').upsert({
            user_id: s.uid, checked_at: today, mood, energy: s.mood?.energy ?? 3, word,
          }, { onConflict: 'user_id,checked_at' })
          return null
        })
        return (
          <Tile key={t} icon="😊" title="Mood" done={done.has(t)} tone="border-rose-500/20 bg-rose-500/[0.05]"
            status={current ? `${MOOD_LABELS[current - 1]}${s.mood?.word ? ` · ${s.mood.word}` : ''}` : 'How are you feeling?'}
            onMore={() => onOpen('journal')}>
            <div className="flex justify-between gap-1">
              {MOODS.map((emoji, i) => (
                <button key={i} type="button" disabled={!!busy} aria-label={MOOD_LABELS[i]}
                  onClick={() => setMood(i + 1, s.mood?.word ?? null)}
                  className={cn('flex-1 rounded-xl border py-1.5 text-xl transition-all active:scale-90',
                    current === i + 1 ? 'border-rose-400 bg-rose-500/25 scale-105' : 'border-white/10 bg-white/5 opacity-70 hover:opacity-100')}>
                  {emoji}
                </button>
              ))}
            </div>
            {current > 0 && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                {FEELINGS.map(f => (
                  <TapChip key={f} disabled={!!busy}
                    className={s.mood?.word === f ? 'border-rose-400 bg-rose-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-400'}
                    onClick={() => setMood(current, s.mood?.word === f ? null : f)}>
                    {f}
                  </TapChip>
                ))}
              </div>
            )}
          </Tile>
        )
      }
      case 'sleep': {
        const u = s.usualSleep!
        return (
          <Tile key={t} icon="😴" title="Sleep" done={done.has(t)} tone="border-indigo-500/20 bg-indigo-500/[0.05]"
            status={s.sleep
              ? `${hoursBetween(s.sleep.bedtime, s.sleep.wake_time)}h · ${fmtClock(s.sleep.bedtime)} → ${fmtClock(s.sleep.wake_time)}${s.sleep.quality ? ` · ${QUALITY[s.sleep.quality - 1]}` : ''}`
              : 'Not logged yet'}
            onMore={() => onOpen('sleep')}>
            {!s.sleep && (
              <TapChip disabled={!!busy} className="w-full border-indigo-500/30 bg-indigo-500/15 py-2 text-indigo-100 hover:bg-indigo-500/25"
                onClick={() => tap('sleep', 'Sleep', async () => {
                  await db.from('sleep_logs').upsert({
                    user_id: s.uid, sleep_date: today, bedtime: u.bedtime, wake_time: u.wake_time, updated_at: new Date().toISOString(),
                  }, { onConflict: 'user_id,sleep_date' })
                  return async () => { await db.from('sleep_logs').delete().eq('user_id', s.uid).eq('sleep_date', today) }
                })}>
                {busy === 'sleep' ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                  : <>Log your usual: {fmtClock(u.bedtime)} → {fmtClock(u.wake_time)} · {hoursBetween(u.bedtime, u.wake_time)}h</>}
              </TapChip>
            )}
          </Tile>
        )
      }
      case 'workout': {
        const u = s.usualWorkout
        const logged = s.workouts.map(w => `${WORKOUT_META[w.workout_type]?.label ?? w.workout_type}${w.duration_mins ? ` ${w.duration_mins}m` : ''}`).join(' · ')
        const logWorkout = (type: string, mins: number) => tap(`workout${type}`, WORKOUT_META[type]?.label ?? 'Workout', async () => {
          const id = await insertReturningId('workout_logs', { user_id: s.uid, log_date: today, workout_type: type, duration_mins: mins, exercises: [], notes: null })
          return deleteById('workout_logs', id)
        })
        return (
          <Tile key={t} icon="💪" title="Workout" done={done.has(t)} tone="border-sky-500/20 bg-sky-500/[0.05]"
            status={logged || 'Nothing yet today'} onMore={() => onOpen('workout')}>
            {!s.workouts.length && (
              <div className="flex gap-1.5">
                <TapChip disabled={!!busy} className="flex-1 border-sky-500/30 bg-sky-500/15 py-2 text-sky-100 hover:bg-sky-500/25"
                  onClick={() => logWorkout(u?.workout_type ?? 'cardio', u?.duration_mins ?? 30)}>
                  {busy?.startsWith('workout') && busy !== 'workoutrest' ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                    : <>{WORKOUT_META[u?.workout_type ?? 'cardio']?.icon} Log {u ? 'usual' : ''} {WORKOUT_META[u?.workout_type ?? 'cardio']?.label} · {u?.duration_mins ?? 30}m</>}
                </TapChip>
                <TapChip disabled={!!busy} className="border-white/10 bg-white/5 text-slate-300" onClick={() => logWorkout('rest', 0)}>
                  😴 Rest day
                </TapChip>
              </div>
            )}
          </Tile>
        )
      }
      case 'meal': {
        const kcal = s.meals.reduce((a, m) => a + (m.calories ?? 0), 0)
        const mealType = mealTypeFor(new Date().getHours())
        return (
          <Tile key={t} icon="🍽" title="Meals" done={done.has(t)} tone="border-amber-500/20 bg-amber-500/[0.05]"
            status={s.meals.length ? `${s.meals.length} logged · ${kcal.toLocaleString()} kcal` : `Log your ${mealType}`}
            onMore={() => onOpen('meal')}>
            {s.recentMeals.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {s.recentMeals.map(m => (
                  <TapChip key={m.food_name} disabled={!!busy} className="border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                    onClick={() => tap(`meal${m.food_name}`, m.food_name, async () => {
                      const id = await insertReturningId('nutrition_logs', {
                        user_id: s.uid, log_date: today, meal_type: mealType, logged_at: new Date().toISOString(), ...m,
                      })
                      return deleteById('nutrition_logs', id)
                    })}>
                    {busy === `meal${m.food_name}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>{m.food_name} · {m.calories}</>}
                  </TapChip>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Tap More to log with a photo or a name. Your meals will show up here as one-tap chips.</p>
            )}
          </Tile>
        )
      }
      case 'spend':
        return (
          <Tile key={t} icon="💸" title="Spending" done={done.has(t)} tone="border-violet-500/20 bg-violet-500/[0.05]"
            status={s.spentToday > 0 ? `${rupees(s.spentToday)} today` : 'Nothing spent yet today'}
            onMore={() => onOpen('finance')}>
            {s.frequentSpends.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {s.frequentSpends.map(f => {
                  const key = `spend${f.category}${f.amount}${f.description}`
                  return (
                    <TapChip key={key} disabled={!!busy} className="border-violet-500/25 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                      onClick={() => tap(key, f.description || f.category, async () => {
                        const id = await insertReturningId('transactions', {
                          user_id: s.uid, txn_date: today, type: 'expense', category: f.category, amount: f.amount, description: f.description,
                        })
                        return deleteById('transactions', id)
                      })}>
                      {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>{f.description || f.category} · {rupees(f.amount)}</>}
                    </TapChip>
                  )
                })}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Tap More to add an expense. Your regular ones will show up here as one-tap chips.</p>
            )}
          </Tile>
        )
      case 'plans':
        return (
          <Tile key={t} icon="✅" title="Habits & plans" done={false} tone="border-emerald-500/20 bg-emerald-500/[0.05]"
            status="Check off today's habits and plans" onMore={() => onOpen('plans')} />
        )
    }
  }

  const loggedCount = done.size
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-slate-500">
        {loggedCount === 0 ? 'Tap to log. Nothing to type.' : `${loggedCount} of 6 logged today`}
      </p>

      {tiles.map(tileFor)}

      <div className="grid grid-cols-3 gap-2 pt-1">
        {([
          ['voice', Mic, 'Say it'],
          ['journal', BookOpen, 'Journal'],
          ['task', ClipboardList, 'Task'],
        ] as const).map(([panel, Icon, label]) => (
          <button key={panel} type="button" onClick={() => onOpen(panel)}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-[11px] text-slate-400 hover:text-white active:scale-95 transition-all">
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {undo && (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-800/95 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Logged {undo.label}</span>
          <button type="button" onClick={runUndo} className="flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
        </div>
      )}
    </div>
  )
}
