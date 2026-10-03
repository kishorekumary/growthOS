const CACHE = 'zenith-v1'

const PRECACHE = [
  '/',
  '/dashboard',
  '/focus',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ─── Install: pre-cache shell ─────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  )
})

// ─── Activate: clean old caches ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

// ─── Fetch: network-first for API/auth, cache-first for assets ────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET, cross-origin, Supabase, and API requests
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase')
  ) return

  // Network-first for HTML navigation (always get fresh page)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => { caches.open(CACHE).then(c => c.put(request, res.clone())); return res })
        .catch(() => caches.match(request).then(cached => cached ?? caches.match('/dashboard')))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    url.pathname.match(/\.(js|css|png|svg|ico|woff2?|ttf)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          caches.open(CACHE).then(c => c.put(request, res.clone()))
          return res
        })
      })
    )
    return
  }
})

// ─── Push notifications ───────────────────────────────────────────
// Payload: { title, body, url, tag, habitId?, habitName? } — see
// src/app/api/cron/reminders/route.ts. With a habitId, the notification
// offers a one-tap "mark done" action (Chrome/Android; iOS has no actions
// and simply opens `url` on tap).
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  const actions = data.habitId
    ? [
        { action: 'habit-done', title: `✓ ${truncate(data.habitName ?? 'Mark done', 24)}` },
        { action: 'open',       title: 'Open' },
      ]
    : []
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Zenith Reminder', {
      body:    data.body  ?? 'Time to check your tasks!',
      icon:    '/icon-192.png',
      badge:   '/icon-96.png',
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      tag:     data.tag ?? 'zenith-timer',
      actions,
      data:    { url: data.url ?? '/dashboard', habitId: data.habitId, habitName: data.habitName },
    })
  )
})

function truncate(str, n) {
  return str.length > n ? `${str.slice(0, n - 1)}…` : str
}

// Browser-local YYYY-MM-DD — the same "today" the app itself sends
// (src/lib/habitStreak.ts todayStr), since the server can't know the user's day.
function localToday() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function openUrl(url) {
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) { client.navigate(url); return client.focus() }
    }
    return clients.openWindow(url)
  })
}

// Logs the habit straight from the notification. Same-origin fetch from the
// worker carries the session cookies, and the middleware refreshes them.
// On any failure (signed out, offline) fall back to opening the app.
async function completeFromNotification(data) {
  try {
    const res = await fetch('/api/habits/complete', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habit_id: data.habitId, for: 'today', date: localToday() }),
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const { streak_count } = await res.json()
    await self.registration.showNotification(`✓ ${data.habitName ?? 'Habit'} done`, {
      body:  streak_count > 1 ? `🔥 ${streak_count}-day streak. Nice.` : 'Logged. Keep it going tomorrow.',
      icon:  '/icon-192.png',
      badge: '/icon-96.png',
      tag:   'zenith-habit-done',
      data:  { url: data.url ?? '/personality/habits' },
    })
  } catch {
    await openUrl(data.url ?? '/personality/habits')
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const data = event.notification.data ?? {}
  if (event.action === 'habit-done' && data.habitId) {
    event.waitUntil(completeFromNotification(data))
    return
  }
  event.waitUntil(openUrl(data.url ?? '/dashboard'))
})
