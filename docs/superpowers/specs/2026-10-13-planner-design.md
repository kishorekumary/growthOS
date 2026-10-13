# Planner (Daily / Weekly / Monthly) — Design

Date: 2026-10-13
Status: Approved in brainstorming, pending spec review

## Goal

Replace the Tasks feature (`user_todos`, `/todos`) with a **Planner** that has three clear checklists — **Today**, **This Week**, **This Month** — where items can be added directly to any list, optionally repeat every day/week/month, and checking off is a large, obvious, satisfying action with visible progress.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Item meaning | Both: one-off items belong to a specific day/week/month; any item can optionally repeat each day/week/month |
| Relation to Tasks | New Planner with new tables; Tasks retired; all `user_todos` consumers rewritten |
| Habits | Habits stay a separate feature (streaks, keystone, chest, freezes, leverage untouched). Today's / this week's habits appear **inside** planner lists with a 🔥 badge and can be checked there via existing habit completion |
| Layout | Phone (< `md`): tabs Today · Week · Month. Desktop (≥ `md`): three-column board |
| Unfinished one-offs | Review sheet when a new period starts: Move to now / Reschedule / Done / Drop |
| Missed repeating items | Silently reset; never appear in review |
| Points | day 10, week 20, month 40; +5 if a one-off is completed within its own period |
| Storage approach | Items + completions (no cron materialization) |
| Week | Sunday–Saturday |
| "Today" | Device-local date (same as Habits) |

## 1. Data model — migration `052_planner.sql`

### `public.planner_items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `user_id` | uuid not null → `auth.users` on delete cascade | |
| `title` | text not null | |
| `notes` | text | |
| `period_type` | text not null check in (`day`,`week`,`month`) | |
| `period_start` | date not null | The day / the Sunday / the 1st. For repeating items: first period it applies to |
| `repeats` | boolean not null default false | |
| `is_completed` | boolean not null default false | One-off items only |
| `completed_at` | timestamptz | One-off items only |
| `carry_count` | int not null default 0 | Incremented by "Move to now" in review |
| `ended_at` | timestamptz | Set on Drop (one-off) or stopping a repeat. Hidden from lists; kept for history |
| `sort_order` | int not null default 0 | |
| `legacy_todo_id` | uuid | Source `user_todos.id` for migrated rows |
| `created_at`, `updated_at` | timestamptz default now() | |

Constraint: `period_start` must be aligned to its type — `week` → Sunday (`extract(dow) = 0`), `month` → day 1.

Indexes: `(user_id, period_type, period_start)`, `(user_id) where ended_at is null`.

### `public.planner_completions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `item_id` | uuid not null → `planner_items` on delete cascade | |
| `user_id` | uuid not null → `auth.users` on delete cascade | |
| `period_start` | date not null | The period instance completed |
| `completed_at` | timestamptz not null default now() | |
| `points_awarded` | int not null default 0 | |

Unique `(item_id, period_start)`. Index `(user_id, period_start)`.

### RLS

Both tables: RLS enabled, single "own data" policy (`auth.uid() = user_id`) for all operations, matching `008_todos.sql`.

### Data migration (same file)

- `user_todos` with `due_date` → `period_type='day'`, `period_start=due_date`, copy `title`, `notes`, `is_completed`, `completed_at`, `created_at`, `legacy_todo_id=id`.
- `user_todos` without `due_date` → `period_type='week'`, `period_start` = Sunday of `current_date`.
- Idempotent: skip rows whose `id` already exists as a `legacy_todo_id`.
- `user_todos` is **not** dropped; a later migration drops it after verification.

Migrations are applied manually in the Supabase dashboard; this file must be applied before the code deploys.

## 2. Domain logic — `src/lib/planner/`

Pure, framework-free modules (unit-tested):

- `periods.ts`
  - `periodStart(type, date)` → day itself / previous-or-same Sunday / 1st of month (local date strings `YYYY-MM-DD`, using date-fns).
  - `shiftPeriod(type, start, n)`; `periodLabel(type, start)` ("Today", "Tue, Oct 13", "This week", "Oct 11–17", "October").
  - `currentPeriods(today)` → `{ day, week, month }` starts.
- `visibility.ts`
  - `isVisibleIn(item, type, start)`: `ended_at` is null, same `period_type`, and either (`!repeats && period_start === start`) or (`repeats && period_start <= start`).
  - `isDoneIn(item, start, completions)`: one-off → `is_completed`; repeating → completion exists for `(item.id, start)`.
  - `leftovers(items, today)`: one-off, not completed, not ended, `period_start < currentPeriod(type)`.
- `points.ts`
  - `BASE = { day: 10, week: 20, month: 40 }`, `ON_TIME_BONUS = 5`.
  - `pointsFor(item, completedOn, { fromReview })`: base + bonus if one-off and `completedOn` falls within the item's period and not `fromReview`. Repeating: base only.
- `queries.ts` — shared Supabase query helpers taking a client (server or browser): `fetchPlannerRange(client, userId, today)`, `insertItem`, `updateItem`, `toggleItem`, `moveItem`, `endItem`.
- `rewards.ts` — award / revoke points through existing `user_rewards`, `reward_points_log`, `increment_points_balance` (logic lifted from `TodoList.tsx`, with source label `planner`).

## 3. Planner screen

Route `src/app/(main)/planner/page.tsx` (server component: auth + initial data). `/todos` → redirect to `/planner`.

Components in `src/components/planner/`:

- **`PlannerView`** (client) — responsive container.
  - `< md`: tabs **Today · Week · Month** with "done/total" counts; active tab shows progress ring + `PeriodList`.
  - `≥ md`: three `PeriodList` columns with progress bars.
  - Header ‹ date › navigator shifts the anchor date (desktop: all columns shift together; phone: the active tab's period).
- **`PeriodList`** — progress, `QuickAdd` at top, open items (habits first, then items by `sort_order`), collapsible "Done (n)" group.
- **`PlannerItemRow`** — 28px round checkbox (≥44px hit area), title, ↻ badge if repeating, "↪ n×" if `carry_count > 0`, ⋯ menu: Edit, Move to…, Repeat on/off, Delete. Notes expand inline.
- **`HabitRow`** — habit due today (daily habits in Today; weekly habits in Week) with same checkbox + 🔥 streak badge; toggling calls existing `completeHabit()` (`src/lib/completeHabit.ts`). Hidden habits excluded. Not editable here; links to Habits page.
- **`QuickAdd`** — text input, Enter adds to that list's current period; ↻ toggle sets `repeats`.
- **`MoveMenu`** — Today, Tomorrow, This week, Next week, This month, Next month (changes `period_type` + `period_start`).
- **`usePlanner(anchorDate)`** — loads items, completions, habits for the day/week/month containing the anchor; optimistic toggle/add/move/end with rollback on error; awards points.

Check-off feel: circle fills green with a short scale "pop", row fades to strike-through and moves to Done after ~600ms, floating "+N" points indicator. Unchecking reverses and revokes points.

Desktop drag-and-drop between columns uses native HTML5 DnD (no new dependency); dropping on a column moves the item to that column's displayed period.

## 4. Review sheet (leftovers)

- **Trigger:** `leftovers(items, today)` non-empty. Shown on Planner page open (bottom sheet on phone, dialog on desktop). Dashboard `PlannerWidget` shows "N leftovers to review" banner opening the same sheet.
- **"Later"** dismisses for the browser session (`sessionStorage`, wrapped in try/catch); reappears next session while leftovers remain.
- **Grouped:** Yesterday & earlier (day), Last week(s) (week), Last month(s) (month).
- **Per item:** Move to now (current period of same type, `carry_count += 1`), Reschedule (MoveMenu), Done (complete with base points, no bonus), Drop (`ended_at = now()`).
- **Per group:** Move all to now, Drop all.
- Repeating items never appear.

## 5. Replacing `user_todos` consumers

| File(s) | Change |
|---|---|
| `src/app/(main)/dashboard/page.tsx`, `src/components/todos/TodoWidget.tsx` | New `PlannerWidget`: today's items + habits, big checkboxes, quick-add, "View week/month" link, leftovers banner |
| `src/components/shared/QuickLog.tsx`, `QuickReset.tsx` | "Task" creation inserts a day item for today |
| `src/components/shared/OpeningBriefingModal.tsx` | Today's planner items; still gated by `show_tasks` |
| `src/app/api/cron/reminders/route.ts`, `src/lib/reminderMessage.ts` | Open items for today; week items on Sunday and Wednesday; month items in the last 3 days of the month |
| `src/app/api/ai/weekly-digest/route.ts` | Completion data from planner (fixes nonexistent `priority` column select) |
| `src/app/api/ai/monthly-retro/route.ts`, `src/app/(main)/checkin/page.tsx` | Completion rates from planner items + completions |
| `src/app/api/search/route.ts` | Search planner item title/notes; result links to `/planner` |
| `src/app/(main)/admin/**`, `src/app/api/superadmin/edit/route.ts`, `src/app/api/push/test/route.ts`, `src/app/api/voice/test/route.ts` | Use `planner_items` |
| `src/app/(main)/personality/(tabs)/journal/page.tsx`, `src/components/personality/HabitTracker.tsx` | Update `/todos` references |
| `Sidebar.tsx`, `BottomNav.tsx`, `MobileDrawer.tsx` | "Tasks" → "Planner", `/planner` |
| `src/components/todos/*`, `src/app/(main)/todos/page.tsx` | Delete; `/todos` becomes a redirect |

`TaskRewards.tsx` tier/score cards move to `src/components/planner/PlannerRewards.tsx` and render in the Planner page header, computed from planner points.

## 6. Error handling

- All mutations optimistic with rollback + toast on Supabase error (pattern from `TodoList.tsx`).
- Completion insert conflict (`unique(item_id, period_start)`) treated as already-done, no double points.
- Points awarded only after the DB write succeeds; revoke on uncheck mirrors award.
- Habit toggles reuse `completeHabit()` error handling unchanged.

## 7. Testing

- Add **Vitest** (dev dependency, `test` script). Unit tests for `src/lib/planner/` — `periods` (Sunday start, month start, year boundary, DST), `visibility` (repeating from earlier start, ended items), `leftovers`, `points` (10/20/40, on-time bonus, review-Done no bonus, repeating).
- `tsc --noEmit`, `npm run lint`, `npm run build` must pass.
- Manual run-through: add to each list, check/uncheck, repeat toggle, move (menu + desktop drag), review sheet actions, dashboard widget, phone + desktop layouts, habit check from planner reflects on Habits page.

## 8. Rollout

1. Implement in a worktree; merge to `develop`; push.
2. User applies `052_planner.sql` in Supabase dashboard **before** the deploy is live.
3. Later migration drops `user_todos` once verified.

## Out of scope

- Merging Habits into the planner, or changing habit features.
- Priorities, tags, projects, sub-tasks, goal links.
- Custom recurrence (e.g. "every Tue/Thu"), time-of-day scheduling, calendar sync.
