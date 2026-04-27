'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Sparkles, Loader2, Save, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
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

const MOOD_EMOJIS = ['😔', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩', '🥳']

function PastEntries({ entries }: { entries: JournalEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (entries.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Past Entries</h3>
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              {entry.mood && <span className="text-lg">{MOOD_EMOJIS[entry.mood - 1]}</span>}
              <span className="text-sm font-medium text-white">
                {format(new Date(entry.entry_date + 'T12:00:00'), 'EEEE, MMM d')}
              </span>
              {entry.mood && <span className="text-xs text-slate-500">{entry.mood}/10</span>}
            </div>
            {expanded === entry.id
              ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
            }
          </button>
          {expanded === entry.id && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
              {entry.ai_feedback && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
                  <p className="text-xs font-semibold text-violet-400 mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> Coach Reflection
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">{entry.ai_feedback}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Journal() {
  const today = new Date().toISOString().split('T')[0]

  const [todayEntry, setTodayEntry]           = useState<JournalEntry | null>(null)
  const [content, setContent]                 = useState('')
  const [mood, setMood]                       = useState(7)
  const [pastEntries, setPastEntries]         = useState<JournalEntry[]>([])
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState<string | null>(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [feedback, setFeedback]               = useState<string | null>(null)
  const [showPast, setShowPast]               = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setLoading(false)
      return
    }
    const userId = session.user.id

    const [{ data: todayData }, { data: past }] = await Promise.all([
      supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('entry_date', today)
        .maybeSingle(),
      supabase
        .from('journal_entries')
        .select('id, entry_date, content, mood, ai_feedback')
        .eq('user_id', userId)
        .neq('entry_date', today)
        .order('entry_date', { ascending: false })
        .limit(10),
    ])

    if (todayData) {
      setTodayEntry(todayData)
      setContent(todayData.content ?? '')
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
    setSaveError(null)
    const supabase = createSupabaseBrowserClient()

    if (todayEntry) {
      const { data, error } = await supabase
        .from('journal_entries')
        .update({ content, mood, updated_at: new Date().toISOString() })
        .eq('id', todayEntry.id)
        .select()
        .single()
      if (error) setSaveError(error.message)
      else if (data) setTodayEntry(data)
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setSaveError('Not signed in'); setSaving(false); return }

      const { data, error } = await supabase
        .from('journal_entries')
        .insert({ user_id: session.user.id, entry_date: today, content, mood })
        .select()
        .single()
      if (error) setSaveError(error.message)
      else if (data) { setTodayEntry(data); fetchData() }
    }
    setSaving(false)
  }

  async function getAiFeedback() {
    if (!content.trim()) return
    setLoadingFeedback(true)
    const supabase = createSupabaseBrowserClient()

    let entryId = todayEntry?.id
    if (!entryId) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoadingFeedback(false); return }

      const { data } = await supabase
        .from('journal_entries')
        .upsert({ user_id: session.user.id, entry_date: today, content, mood })
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Journal</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        {pastEntries.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            {showPast ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showPast ? 'Hide' : 'Past entries'} ({pastEntries.length})
          </button>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400">How are you feeling?</p>
            <span className="text-sm font-semibold text-white">
              {MOOD_EMOJIS[mood - 1]}&nbsp;
              <span className="text-slate-500 text-xs font-normal">{mood}/10</span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {MOOD_EMOJIS.map((emoji, i) => {
              const val = i + 1
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMood(val)}
                  title={`${val}/10`}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-sm transition-all',
                    mood === val
                      ? 'bg-violet-500/30 ring-1 ring-violet-500 scale-110'
                      : 'bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100'
                  )}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="How was your day? What are you grateful for?"
          rows={6}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 leading-relaxed"
        />

        {saveError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{saveError}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={saveEntry}
            disabled={saving || !content.trim()}
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            {saving
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Save className="mr-1.5 h-3.5 w-3.5" />
            }
            Save
          </Button>
          <Button
            size="sm"
            onClick={getAiFeedback}
            disabled={loadingFeedback || !content.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {loadingFeedback
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Reflecting...</>
              : <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Get AI Feedback</>
            }
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-5">
          <p className="text-xs font-semibold text-violet-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Coach Reflection
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">{feedback}</p>
        </div>
      )}

      {showPast && <PastEntries entries={pastEntries} />}
    </div>
  )
}
