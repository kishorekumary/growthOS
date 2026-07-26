# Habit Grace Period + Completion Celebration — Design Spec

Date: 2026-07-26

## Goal

Two independent, standalone improvements to habit tracking:

1. **Grace period**: if a daily habit isn't marked done "today," the user can
   still mark it done — attributed to *yesterday*, preserving the streak —
   any time up until **local noon the next day**. After that, the streak
   breaks as it does today.
2. **Completion celebration**: marking any habit done fires a coin-toss
   animation plus a synthesized sound effect, as a small dopamine hit.

Both are visual/UX-only. Neither introduces a points economy — that's a
separate, already-drafted (unimplemented) design in
`docs/superpowers/specs/2026-07-22-habit-reward-system-design.md`, which this
work does not touch or depend on.

## Current state (relevant facts)

- Streak is a stored column (`personality_habits.streak_count`/`last_done_at`),
  updated lazily only when the user calls "mark done" — there's no scheduled
  streak-break job. A per-day audit table, `habit_logs(habit_id, user_id,
  log_date, status)`, separately records `done`/`missed` per calendar date.
- `computeStreak(current, lastDoneAt, frequency)` is duplicated verbatim in
  three places: `HabitTracker.tsx:81-96`, and twice in `QuickLog.tsx` (shared
  by `HabitPanel` and `VoicePanel`). All three use browser-local `new Date()`
  arithmetic — no per-user timezone is consulted for streak math today
  (`notification_settings.timezone` exists but is only used by cron jobs).
- The `daily-habit-close` cron (`src/app/api/cron/daily-habit-close/route.ts`)
  runs once daily and inserts `habit_logs` rows with `status: 'missed'` for
  any daily habit with no log for the user's local "yesterday." It never
  touches `streak_count` — only the client-side mark-done functions do.
- No confetti/animation library, no toast system in active use, and no audio
  assets or Web Audio usage exist anywhere in the app today.

## Feature 1: Grace period

### Mechanics

No schema changes. A "catch-up" completion is functionally identical to a
normal mark-done, except:
- `habit_logs` is upserted with `log_date` = **yesterday's** date (not
  today's).
- Streak/`last_done_at` update using yesterday as the reference date, so
  `last_done_at` ends up set to yesterday — leaving *today* still separately
  markable afterward through the normal flow.

A habit is "catchable" when, for that specific habit: frequency is `daily`,
there is no `habit_logs` row with `status = 'done'` for yesterday's date, and
`now` (local device time) is before **local noon today**. Weekly-frequency
habits are excluded — their cadence is a 7-day window already and "yesterday"
doesn't map onto them the same way.

If the grace window passes uncaught, no rescue is attempted — the next
ordinary mark-done for that habit computes a 2+ day gap and resets the streak
to 1, exactly as it does today.

### Shared logic extraction

`computeStreak` and `todayStr()` are currently copy-pasted three times; the
grace math needs to be identical everywhere, so this consolidates them (and
the new grace helpers) into one new file, **`src/lib/habitStreak.ts`**:

- `computeStreak(current: number, lastDoneAt: string | null, frequency: 'daily' | 'weekly', referenceDate?: Date): number` — same logic as today, with an added optional reference date (defaults to `new Date()`) so a catch-up call can compute the streak *as of yesterday*.
- `localDateStr(d?: Date): string` — existing local-date formatter, moved here.
- `todayStr()`, `yesterdayStr()`.
- `graceDeadline(referenceDay: Date): Date` — returns local noon of the day *after* `referenceDay`.
- `isGraceActive(now: Date, deadline: Date): boolean`.

All three existing call sites (`HabitTracker.tsx`, `QuickLog.tsx`'s
`HabitPanel` and `VoicePanel`) import from this file instead of keeping their
own copies. This is a one-time consolidation required by the feature itself
(grace math must match everywhere) — it is not the larger reward-system
refactor from the other design doc, and doesn't touch API routes or
Supabase-call structure otherwise.

### UI: dismissible catch-up banner

A single banner (not per-habit rows), shown in **`HabitTracker.tsx`** and a
compact version in **`QuickLog.tsx`'s `HabitPanel`**, whenever one or more
habits are catchable:

> "2 habits missed yesterday — grace ends at 12:00 PM. [Review]"

Expanding it lists each catchable habit with its own "Mark done" button
(performs the catch-up completion described above). An "X" dismisses the
banner for the rest of the day only — stored in `localStorage` keyed by
today's date, mirroring the existing `writeTodayMissed`/`readTodayMissed`
pattern already in `HabitTracker.tsx`. Dismissing hides the nudge; it does
**not** forfeit the habit's actual grace window (the habit is still
catchable until noon even if the banner is hidden — the user just won't see
a reminder).

**`VoicePanel`** (voice-driven logging) is explicitly out of scope for this
banner — voice logging continues to default to "today" only.

### Interaction with the daily-close cron

Unchanged. The cron may write a `'missed'` log for yesterday before the user
catches up — that's fine, since the catch-up flow **upserts** (`onConflict:
'habit_id,user_id,log_date'`), overwriting `'missed'` with `'done'`. The cron
never touches `streak_count`, so there's no race with the streak update
itself.

## Feature 2: Completion celebration

### Trigger points

Fires after every successful "mark done" — the normal today completion *and*
the grace catch-up completion — in all three call sites: `HabitTracker.tsx`,
`QuickLog.tsx`'s `HabitPanel`, and `VoicePanel`'s habit-confirm branch.

### Visual: hand-rolled coin burst

No confetti library is installed, and this codebase's stated convention
(from the existing reward-system plan) is to avoid adding new dependencies
when existing tools suffice. A coin-toss effect is simple enough to hand-roll:

- New component `src/components/shared/CoinBurst.tsx`: on mount, renders
  ~14 coin emoji (🪙) as absolutely-positioned `<span>`s, each assigned a
  randomized horizontal offset/rotation/duration via inline CSS custom
  properties, animated with a CSS `@keyframes` arc-up-and-fall-with-spin,
  fading out; auto-unmounts itself after ~1.2s via a `setTimeout`.
- Honors `prefers-reduced-motion: reduce` — when set, skips the burst and
  instead shows a brief, static checkmark pulse instead of moving coins.

### Sound: synthesized chime, no audio asset

No audio files or Web Audio usage exist in the app today. Rather than
sourcing a copyrighted sound effect, this synthesizes a short two-tone
"cha-ching"-style chime at runtime using the Web Audio API (a couple of
quick `OscillatorNode` blips through a `GainNode` envelope) — no new asset
files, no new dependencies. Playback is invoked synchronously from the same
click handler that performs the mark-done action, satisfying browsers'
autoplay-requires-user-gesture rule.

### Shared hook

Both pieces are wrapped in one small hook, `useHabitCelebration()`
(`src/hooks/useHabitCelebration.ts`), returning `{ celebrate, CelebrationPortal }`
— `celebrate()` triggers the coin burst + sound; `<CelebrationPortal />` is
rendered once per call site and renders `<CoinBurst>` when active. This
keeps all three call sites down to a one-line `celebrate()` call after a
successful mark-done, and a single `<CelebrationPortal />` in their JSX.

## Edge cases

- **Multiple catchable habits at once**: the banner lists all of them; each
  has its own independent "Mark done" button and streak update.
- **Weekly habits**: never appear in the catch-up banner; unaffected by this
  feature entirely.
- **Global habits** (`is_global`): included in grace catch-up (they still
  have per-user `habit_logs` rows and users still want to complete them),
  but — consistent with existing behavior — skip the `personality_habits`
  streak/`last_done_at` write, since that row is shared across all users.
- **Multiple devices/tabs**: no locking beyond what already exists for
  habit writes today; a double-catch-up race is a normal concurrent-update
  scenario already tolerated by the existing upsert pattern.
- **Grace window spans a date-line/DST edge**: grace deadline is computed
  fresh each render from the browser's current local time, so it
  self-corrects; no persisted deadline value to go stale.
- **Undo**: `undoLog` is unaffected — undoing a catch-up completion behaves
  like undoing any other day's log (deletes the `habit_logs` row for that
  `log_date`, decrements streak), since it isn't scoped to "today" already.
- **`habit_logs` table unavailable** (the existing `logsUnavailable`
  fallback path, used when that table can't be reached): the catch-up
  banner requires reading yesterday's `habit_logs` row to know what's
  catchable, so it simply doesn't render in this fallback mode — same
  degrade-gracefully precedent as the rest of `HabitTracker.tsx`.
- **Coin burst clipped by a container**: `QuickLog.tsx`'s floating panel
  may clip `position: fixed` children if an ancestor establishes its own
  containing block (e.g. via `transform`). `CoinBurst`/`CelebrationPortal`
  renders through `createPortal(..., document.body)` so it always escapes
  any ancestor, regardless of that ancestor's styling.

## Out of scope

- No points/rewards/milestone economy — see the separate existing design doc
  if that work is picked up later.
- No voice-driven catch-up (`VoicePanel` stays today-only).
- No real audio asset file — sound is synthesized, not sourced.
- No per-user timezone wiring for the grace deadline — uses local device
  time, per explicit decision during design.

## Verification

No test framework exists in this repo (confirmed: no jest/vitest, no
`*.test.*` files). Verification is `npx tsc --noEmit`, a full `next build`,
and manual reasoning/walkthrough — consistent with how every other feature
in this codebase has been verified.
