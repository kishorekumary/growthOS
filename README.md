# GrowthOS

A personal growth operating system built with Next.js and Supabase. Track habits, fitness, finances, reading, and goals — all in one place.

---

## Features

### Dashboard
- AI-powered daily greeting
- Today's tasks at a glance with quick-add
- Overview cards for all sections (Personality, Fitness, Finance, Books)
- Daily Practice section — personal pledge, affirmations, and gratitude list

### Personality
- Habit tracking with streak counters
- Daily habit check-ins
- Personality insights and AI coaching

### Fitness
- Workout logging (type, duration, exercises, notes)
- Weekly workout counter
- Weight tracking with progress chart
- AI fitness coach

### Finance
- Financial health score
- Expense tracker with monthly filtering
- Budget management
- Spending chart
- Financial goals
- AI finance coach

### Books
- Reading list (discover, track, complete)
- Books completed counter
- Reading challenge
- AI book coach

### Goals
- Goal management across all categories (Fitness, Finance, Books, General)
- Target date with days-remaining countdown
- Overdue indicators
- Goals widget embedded in each section page
- Mark complete inline

### Tasks (Todos)
- Today / This Week / All filter tabs
- Optional due date and collapsible notes per task
- Overdue highlighting
- Complete / uncomplete / delete
- Quick-add widget on the Dashboard

### Daily Practice
- Personal pledge with formatting preserved
- Affirmations list
- Gratitude list
- Edit inline from the Dashboard

### Notifications
- Browser/PWA push notifications
- Email reminders via Resend
- Two configurable daily reminder times (morning + evening)
- Auto-detected timezone
- Prevents duplicate sends per day

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Styling | Tailwind CSS |
| UI Components | Radix UI + shadcn/ui |
| Charts | Recharts |
| AI | Anthropic Claude API |
| Email | Resend |
| Push Notifications | Web Push API (VAPID) |
| Mobile | Capacitor (Android / iOS) |
| Scheduling | Vercel Cron |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Resend](https://resend.com) account (for email notifications)

### 1. Clone and install

```bash
git clone <repo-url>
cd growthOS
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Push notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:you@example.com

# Email (Resend)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=GrowthOS <you@yourdomain.com>

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
CRON_SECRET=any-random-secret-string

# AI
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Generate VAPID keys once:
```bash
npx web-push generate-vapid-keys
```

### 3. Run database migrations

Open your Supabase project → SQL Editor and run each migration file in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_add_habit_category.sql
supabase/migrations/003_fitness_extensions.sql
supabase/migrations/004_finance_budget.sql
supabase/migrations/005_books_challenge.sql
supabase/migrations/006_user_goals.sql
supabase/migrations/007_daily_practice.sql
supabase/migrations/008_todos.sql
supabase/migrations/009_notifications.sql
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com)
2. Add all environment variables from `.env.local` in Vercel → Settings → Environment Variables
3. Deploy — Vercel Cron (configured in `vercel.json`) runs every 15 minutes to send scheduled notifications

> **Note:** Vercel Cron requires the Pro plan for sub-hourly schedules. On the free Hobby plan, use [cron-job.org](https://cron-job.org) (free) to call `https://your-app.vercel.app/api/cron/reminders` every 15 minutes with header `Authorization: Bearer YOUR_CRON_SECRET`.

---

## Mobile (Capacitor)

The app can be built as a native Android or iOS app using Capacitor.

```bash
# Sync web assets to native project
npm run cap:sync

# Open in Android Studio
npm run cap:open

# Run on connected device
npm run cap:run
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login / signup pages
│   ├── (main)/          # Authenticated app
│   │   ├── dashboard/
│   │   ├── personality/
│   │   ├── fitness/
│   │   ├── finance/
│   │   ├── books/
│   │   ├── goals/
│   │   ├── todos/
│   │   └── settings/
│   └── api/
│       ├── push/        # Subscribe, unsubscribe, test push
│       ├── cron/        # Scheduled notification sender
│       └── chat/        # AI coach endpoints
├── components/
│   ├── layout/          # Sidebar, BottomNav, ServiceWorkerRegister
│   ├── shared/          # DailyGreetingCard, DailyPractice, AIChat
│   ├── fitness/
│   ├── finance/
│   ├── books/
│   ├── goals/
│   ├── todos/
│   └── settings/
├── lib/
│   ├── supabase.ts          # Browser client
│   ├── supabase-server.ts   # Server client
│   └── supabase-admin.ts    # Admin client (service role)
└── supabase/
    └── migrations/          # SQL migration files
```

---

## Notification Setup

1. Go to **Settings** in the sidebar
2. Toggle **Push Notifications** — your browser will ask for permission
3. Toggle **Email Reminders**
4. Set your morning and evening reminder times
5. Click **Save**
6. Use **Send test notification** to verify push is working

---

## License

Private — personal use only.
