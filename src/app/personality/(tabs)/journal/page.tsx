'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Sparkles, Loader2, Save } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface JournalEntry {
  id: string
  entry_date: string
  content: string
  mood: number | null
  ai_feedback: string | null
}

const MOOD_LABELS: Record<number, string> = {
  1: '😞', 2: '😟', 3: '😕', 4: '😐', 5: '🙂',
  6: '😊', 7: '😄', 8: '😁', 9: '🤩', 10: '🥳',
}

export default function JournalPage() {
  const today = new Date().toISOString().split('T')[0]
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null)
  const [content, setContent] = useState('')
  const [mood, setMood] = useState(7)
  const [saving, setSaving] = useState(false)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pastEntries, setPastEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createSupabaseBrowserClient()

  const fetchData = useCallback(async () => {
    const [{ data: todayData }, { data: past }] = await Promise.all([
      supabase
        .from('journal_entries')
        .select('*')
        .eq('entry_date', today)
        .maybeSingle(),
      supabase
        .from('journal_entries')
        .select('id, entry_date, mood, content, ai_feedback')
        .neq('entry_date', today)
        .order('entry_date', { ascending: false })
        .limit(5),
    ])

    if (todayData) {
      setTodayEntry(todayData)
      setContent(todayData.content)
      setMood(todayData.mood ?? 7)
      setFeedback(todayData.ai_feedback ?? null)
    }
    setPastEntries(past ?? [])
    setLoading(false)
  }, [today])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveEntry() {
    if (!content.trim()) return
    setSaving(true)

    if (todayEntry) {
      const { data } = await supabase
        .from('journal_entries')
        .update({ content, mood, updated_at: new Date().toISOString() })
        .eq('id', todayEntry.id)
        .select()
        .single()
      if (data) setTodayEntry(data)
    } else {
      const { data } = await supabase
        .from('journal_entries')
        .insert({ entry_date: today, content, mood })
        .select()
        .single()
      if (data) setTodayEntry(data)
    }
    setSaving(false)
  }

  async function getAiFeedback() {
    if (!content.trim()) return
    setLoadingFeedback(true)

    let entryId = todayEntry?.id
    if (!entryId) {
      const { data } = await supabase
        .from('journal_entries')
        .upsert({ entry_date: today, content, mood })
        .select()
        .single()
      if (data) { setTodayEntry(data); entryId = data.id }
    }

    const res = await fetch('/api/ai/journal-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, mood, entryId }),
    })
    const data = await res.json()
    setFeedback(data.feedback ?? null)
    setLoadingFeedback(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Today's entry */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">
            {format(new Date(), 'EEEE, MMMM d')}
          </h2>
          <span className="text-xs text-slate-500">Today</span>
        </div>

        {/* Mood selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">How are you feeling? {MOOD_LABELS[mood]}</p>
            <span className="text-xs font-semibold text-violet-300">{mood}/10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-full accent-violet-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>Rough day</span>
            <span>Amazing</span>
          </div>
        </div>

        {/* Text area */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind today? Reflect on your wins, challenges, or anything you'd like to process..."
          rows={6}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={saveEntry}
            disabled={saving || !content.trim()}
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button
            onClick={getAiFeedback}
            disabled={loadingFeedback || !content.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {loadingFeedback
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Getting feedback...</>
              : <><Sparkles className="mr-2 h-4 w-4" /> Get AI Feedback</>
            }
          </Button>
        </div>
      </div>

      {/* AI Feedback */}
      {feedback && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-violet-300">Coach Feedback</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{feedback}</p>
        </div>
      )}

      {/* Past entries */}
      {pastEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Past Entries</h3>
          {pastEntries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">
                  {format(new Date(entry.entry_date + 'T12:00:00'), 'MMM d, yyyy')}
                </span>
                {entry.mood && (
                  <span className="text-sm">{MOOD_LABELS[entry.mood]} <span className="text-xs text-slate-500">{entry.mood}/10</span></span>
                )}
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{entry.content}</p>
              {entry.ai_feedback && (
                <p className="text-xs text-violet-400/70 mt-2 line-clamp-1">
                  💬 {entry.ai_feedback}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
