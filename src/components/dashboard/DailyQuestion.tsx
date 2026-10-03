'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageCircleQuestion, Loader2, Check, ArrowRight } from 'lucide-react'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { todayStr, yesterdayStr, localDateStr } from '@/lib/habitStreak'
import { dailyQuestion, DAILY_QUESTION_POINTS, DAILY_QUESTION_TAG } from '@/lib/dailyQuestion'

interface Habit  { id: string; habit_name: string; frequency: string; is_global: boolean; created_at: string }
interface Log    { habit_id: string; status: string }
interface IdMark { habit_id: string }
interface Answer { id: string; content: string }

// One reflective question a day, answered in place and saved to the journal.
export default function DailyQuestion() {
  const today     = todayStr()
  const yesterday = yesterdayStr()

  const { data: habits } = useCachedQuery<Habit[]>(
    'dq:habits',
    (supabase, userId) => supabase
      .from('personality_habits')
      .select('id, habit_name, frequency, is_global, created_at')
      .or(`user_id.eq.${userId},is_global.eq.true`),
    [],
  )
  const { data: hidden } = useCachedQuery<IdMark[]>(
    'hidden-global-habits',
    (supabase, userId) => supabase.from('user_hidden_habits').select('habit_id').eq('user_id', userId),
    [],
  )
  const { data: yLogs, loading: yLogsLoading } = useCachedQuery<Log[]>(
    `dq:logs:${yesterday}`,
    (supabase, userId) => supabase
      .from('habit_logs').select('habit_id, status')
      .eq('user_id', userId).eq('log_date', yesterday),
    [],
    [yesterday],
  )
  const { data: answers, loading: answersLoading, setData: setAnswers } = useCachedQuery<Answer[]>(
    `dq:answer:${today}`,
    (supabase, userId) => supabase
      .from('journal_entries').select('id, content')
      .eq('user_id', userId).eq('entry_date', today).contains('tags', [DAILY_QUESTION_TAG])
      .limit(1),
    [],
    [today],
  )

  const question = useMemo(() => {
    const hiddenIds = new Set(hidden.map(h => h.habit_id))
    // Daily habits that existed yesterday — one created today can't have been missed.
    const daily = habits.filter(h =>
      h.frequency === 'daily' && !(h.is_global && hiddenIds.has(h.id)) &&
      localDateStr(new Date(h.created_at)) <= yesterday)
    const doneIds = new Set(yLogs.filter(l => l.status === 'done').map(l => l.habit_id))
    return dailyQuestion(today, {
      done:   daily.filter(h => doneIds.has(h.id)).map(h => h.habit_name),
      missed: daily.filter(h => !doneIds.has(h.id)).map(h => h.habit_name),
    })
  }, [habits, hidden, yLogs, today, yesterday])

  const [draft, setDraft]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const answered = answers[0]

  async function submit() {
    if (!draft.trim() || saving) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/journal/daily-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, question, answer: draft }),
    })
    if (res.ok) {
      setAnswers([{ id: 'local', content: draft.trim() }])
      setDraft('')
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not save your answer')
    }
    setSaving(false)
  }

  // Hold off until yesterday's logs load, so the question doesn't swap mid-read.
  if (answersLoading || (yLogsLoading && yLogs.length === 0)) return null

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">Today&apos;s Question</span>
        </div>
        {!answered && <span className="text-[11px] text-amber-400/80">+{DAILY_QUESTION_POINTS} pts</span>}
      </div>

      <p className="text-sm text-slate-200 leading-relaxed">{question}</p>

      {answered ? (
        <div className="space-y-2">
          <p className="rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-sm text-slate-400 line-clamp-3">
            {answered.content}
          </p>
          <Link href="/journal" className="flex items-center gap-1 text-xs text-emerald-400/80 hover:text-emerald-300">
            <Check className="h-3 w-3" /> Saved to your journal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="A sentence or two is enough…"
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || saving}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 px-3 py-2 text-xs font-semibold text-white transition-all"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save answer
          </button>
        </div>
      )}
    </div>
  )
}
