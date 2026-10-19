'use client'

import { Capacitor } from '@capacitor/core'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { nightlySleep, sleepRow, workoutRow, type HcSleep, type HcWorkout } from './mapping'

// Imports workouts and sleep from Samsung Health via Android Health Connect
// (@capgo/capacitor-health). Only in the Android app — Health Connect has
// no web API and only answers apps that are open on screen.

const CONNECTED_KEY = 'growthos:health-connected'
const LAST_SYNC_KEY = 'growthos:health-last-sync'
const HISTORY_KEY   = 'growthos:health-history'
const READ = ['workouts', 'sleep'] as const

export const healthSupported = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} },
  del: (k: string) => { try { localStorage.removeItem(k) } catch {} },
}

export const isHealthConnected = () => store.get(CONNECTED_KEY) === '1'
export const lastHealthSync = () => store.get(LAST_SYNC_KEY)

async function plugin() {
  const { Health } = await import('@capgo/capacitor-health')
  return Health
}

export async function healthAvailability(): Promise<{ available: boolean; reason?: string }> {
  if (!healthSupported()) return { available: false, reason: 'Available in the GrowthOS Android app' }
  try {
    const r = await (await plugin()).isAvailable()
    return { available: r.available, reason: r.available ? undefined : 'Install or update “Health Connect” from the Play Store' }
  } catch {
    return { available: false, reason: 'Update the GrowthOS app to connect Samsung Health' }
  }
}

// Shows Health Connect's permission sheet. Asks for older history too, so
// the first import can go back further than 30 days where supported.
export async function connectHealth(): Promise<{ ok: boolean; message?: string }> {
  const Health = await plugin()
  const status = await Health.requestAuthorization({ read: [...READ], requestHistoryAccess: true })
  const granted = READ.filter(t => status.readAuthorized.includes(t))
  if (!granted.length) return { ok: false, message: 'Allow Exercise and Sleep in Health Connect to import them' }
  store.set(CONNECTED_KEY, '1')
  store.set(HISTORY_KEY, status.historyAccessAuthorized ? '1' : '0')
  return { ok: true, message: granted.length < READ.length ? `Only ${granted.join(' and ')} was allowed` : undefined }
}

export function disconnectHealth() {
  store.del(CONNECTED_KEY); store.del(LAST_SYNC_KEY)
}

export async function openHealthSettings() {
  try { await (await plugin()).openHealthConnectSettings() } catch {}
}

export interface SyncResult { workouts: number; nights: number; skippedNights: number }

export async function syncHealth(): Promise<SyncResult> {
  const Health = await plugin()
  const db = createSupabaseBrowserClient()
  const { data: { session } } = await db.auth.getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('Sign in first')

  // From a day before the last sync (catches late-arriving records), or on
  // the first run back 30 days — a year if history access was granted.
  const last = lastHealthSync()
  const firstDays = store.get(HISTORY_KEY) === '1' ? 365 : 30
  const since = last ? new Date(new Date(last).getTime() - 86_400_000) : new Date(Date.now() - firstDays * 86_400_000)
  const range = { startDate: since.toISOString(), endDate: new Date().toISOString() }

  // Workouts, paged.
  const workouts: HcWorkout[] = []
  let anchor: string | undefined
  for (let page = 0; page < 20; page++) {
    const r = await Health.queryWorkouts({ ...range, limit: 100, ascending: true, anchor })
    workouts.push(...(r.workouts as HcWorkout[]))
    if (!r.anchor || !r.workouts.length) break
    anchor = r.anchor
  }
  const workoutRows = workouts.map(w => ({ user_id: uid, ...workoutRow(w) }))
  if (workoutRows.length) {
    const { error } = await db.from('workout_logs').upsert(workoutRows, { onConflict: 'user_id,external_id' })
    if (error) throw new Error(error.message.includes('external_id') ? 'The database needs migration 056 first' : error.message)
  }

  // Sleep: one night per wake-up day; never replace a night logged by hand.
  const { samples } = await Health.readSamples({ dataType: 'sleep', ...range, limit: 1000, ascending: true })
  const nights = nightlySleep(samples as HcSleep[])
  let skipped = 0
  if (nights.size) {
    const days = Array.from(nights.keys())
    const { data: existing, error: exErr } = await db.from('sleep_logs')
      .select('sleep_date, source').eq('user_id', uid).in('sleep_date', days)
    if (exErr) throw new Error(exErr.message.includes('source') ? 'The database needs migration 056 first' : exErr.message)
    const manual = new Set((existing ?? []).filter(r => !r.source).map(r => r.sleep_date))
    const rows = days.filter(d => !manual.has(d)).map(d => ({ user_id: uid, ...sleepRow(d, nights.get(d)!), updated_at: new Date().toISOString() }))
    skipped = days.length - rows.length
    if (rows.length) {
      const { error } = await db.from('sleep_logs').upsert(rows, { onConflict: 'user_id,sleep_date' })
      if (error) throw new Error(error.message)
    }
  }

  store.set(LAST_SYNC_KEY, new Date().toISOString())
  return { workouts: workoutRows.length, nights: nights.size - skipped, skippedNights: skipped }
}

// Quiet background sync when the app opens, at most every 30 minutes.
export async function autoSyncHealth(): Promise<SyncResult | null> {
  if (!healthSupported() || !isHealthConnected()) return null
  const last = lastHealthSync()
  if (last && Date.now() - new Date(last).getTime() < 30 * 60_000) return null
  try { return await syncHealth() } catch { return null }
}
