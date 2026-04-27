'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Sparkles, Loader2, Save, Pencil, ChevronDown, ChevronUp, AlertCircle, BookOpen } from 'lucide-react'
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

// ─── Entry card (read-only, used for today and past entries) ──

function EntryCard({
  entry,
  isToday,
  onEdit,
}: {
  entry: JournalEntry
  isToday: boolean
  onEdit?: () => void
}) {
  const [expanded, setExpanded] = useState(isToday)

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all',
      isToday ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/10 bg-white/5'
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          {entry.mood != null && (
            <span className="text-lg">{MOOD_EMOJIS[entry.mood - 1]}</span>
          )}
          <div>
            <p className="text-sm font-medium text-white">
              {isToday ? 'Today' : format(new Date(entry.entry_date + 'T12:00:00'), 'EEEE, MMM d')}
            </p>
            {entry.mood != null && (
              <p className="text-xs text-slate-500">{entry.mood}/10 mood</p>
            )}
          </div>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-slate-500 ml-auto" />
            : <ChevronDown className="h-4 w-4 text-slate-500 ml-auto" />
          }
        </button>
        {isToday && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-3 shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {entry.content}
          </p>
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
  )
}

// ─── Write / edit form ────────────────────────────────────────

function EntryEditor({
  initialContent,
  initialMood,
  onSave,
  onCancel,
  isNew,
}: {
  initialContent: string
  initialMood: number
  onSave: (content: string, mood: number) => Promise<string | null>
  onCancel?: () => void
  isNew: boolean
}) {
  const [content, setContent]   = useState(initialContent)
  const [mood, setMood]         = useState(initialMood)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    const err = await onSave(content, mood)
    if (err) setError(err)
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      {/* Mood */}
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

      {/* Text */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="How was your day? What are you grateful for?"
        rows={6}
        autoFocus
        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 leading-relaxed"
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          {saving
            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : <Save className="mr-1.5 h-3.5 w-3.5" />
          }
          {isNew ? 'Save Entry' : 'Update Entry'}
        </Button>
        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            className="border-white/20 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function Journal() {
  const today = new Date().toISOString().split('T')[0]

  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null)
  const [pastEntries, setPastEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
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
        .limit(20),
    ])

    if (todayData) {
      setTodayEntry(todayData)
      setFeedback(todayData.ai_feedback ?? null)
    }
    setPastEntries(past ?? [])
    setLoading(false)
  }, [today])

  useEffect(() => { fetchData() }, [fetchData])

  // Called by EntryEditor — returns error string or null on success
  async function handleSave(content: string, mood: number): Promise<string | null> {
    const supabase = createSupabaseBrowserClient()

    if (todayEntry) {
      const { data, error } = await supabase
        .from('journal_entries')
        .update({ content, mood, updated_at: new Date().toISOString() })
        .eq('id', todayEntry.id)
        .select()
        .single()
      if (error) return error.message
      if (data) { setTodayEntry(data); setEditing(false) }
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return 'Not signed in'

      const { data, error } = await supabase
        .from('journal_entries')
        .insert({ user_id: session.user.id, entry_date: today, content, mood })
        .select()
        .single()
      if (error) return error.message
      if (data) { setTodayEntry(data); setEditing(false) }
    }
    return null
  }

  async function getAiFeedback() {
    if (!todayEntry) return
    setLoadingFeedback(true)
    const res = await fetch('/api/ai/journal-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: todayEntry.content, mood: todayEntry.mood, entryId: todayEntry.id }),
    })
    const data = await res.json()
    setFeedback(data.feedback ?? null)
    if (data.feedback) {
      setTodayEntry((prev) => prev ? { ...prev, ai_feedback: data.feedback } : prev)
    }
    setLoadingFeedback(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const totalEntries = (todayEntry ? 1 : 0) + pastEntries.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Journal</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
            {totalEntries > 0 && ` · ${totalEntries} entr${totalEntries === 1 ? 'y' : 'ies'}`}
          </p>
        </div>
        {/* Show "New Entry" only if today's entry doesn't exist and not already editing */}
        {!todayEntry && !editing && (
          <Button
            size="sm"
            onClick={() => setEditing(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
          >
            <Pencil className="h-4 w-4" /> New Entry
          </Button>
        )}
      </div>

      {/* Write new entry (when no today entry yet) */}
      {!todayEntry && editing && (
        <EntryEditor
          initialContent=""
          initialMood={7}
          isNew={true}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Prompt to write if nothing exists yet */}
      {!todayEntry && !editing && totalEntries === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <BookOpen className="h-10 w-10 text-violet-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No journal entries yet.</p>
          <p className="text-slate-600 text-xs mt-1">Start writing to track your thoughts and mood.</p>
        </div>
      )}

      {/* Today's entry — edit mode */}
      {todayEntry && editing && (
        <EntryEditor
          initialContent={todayEntry.content}
          initialMood={todayEntry.mood ?? 7}
          isNew={false}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Today's entry — view mode */}
      {todayEntry && !editing && (
        <div className="space-y-3">
          <EntryCard
            entry={todayEntry}
            isToday={true}
            onEdit={() => setEditing(true)}
          />

          {/* AI Feedback button (only when no feedback yet) */}
          {!feedback && (
            <Button
              size="sm"
              onClick={getAiFeedback}
              disabled={loadingFeedback}
              className="w-full bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/20"
              variant="outline"
            >
              {loadingFeedback
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Reflecting...</>
                : <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Get AI Feedback</>
              }
            </Button>
          )}

          {feedback && (
            <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-5">
              <p className="text-xs font-semibold text-violet-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Coach Reflection
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Past entries list — always visible */}
      {pastEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pt-2">
            Past Entries
          </h3>
          {pastEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} isToday={false} />
          ))}
        </div>
      )}
    </div>
  )
}
