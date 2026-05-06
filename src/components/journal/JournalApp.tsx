'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, Square, Save, Plus, Trash2, Pencil, X, ChevronLeft } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'

interface Entry {
  id: string
  entry_date: string
  title: string | null
  content: string
  mood: number | null
  tags: string[]
  created_at: string
}

const MOOD_META = [
  null,
  { label: 'Rough',  emoji: '😔', color: '#ef4444' },
  { label: 'Low',    emoji: '😕', color: '#f97316' },
  { label: 'Okay',   emoji: '😐', color: '#94a3b8' },
  { label: 'Good',   emoji: '🙂', color: '#22c55e' },
  { label: 'Great',  emoji: '😊', color: '#a78bfa' },
]

export default function JournalApp() {
  const supabase = createSupabaseBrowserClient()
  const [entries, setEntries] = useState<Entry[]>([])
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [editing, setEditing] = useState<Entry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // editor fields
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // voice
  const [recording, setRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setVoiceSupported(!!(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    ))
    loadEntries()
  }, [])

  async function loadEntries() {
    const { data } = await supabase
      .from('journal_entries')
      .select('id,entry_date,title,content,mood,tags,created_at')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60)
    if (data) setEntries(data)
  }

  function openNew() {
    setEditing(null)
    setTitle('')
    setContent('')
    setMood(null)
    setView('editor')
  }

  function openEdit(entry: Entry) {
    setEditing(entry)
    setTitle(entry.title ?? '')
    setContent(entry.content)
    setMood(entry.mood)
    setView('editor')
  }

  async function save() {
    if (!content.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('journal_entries').update({
        title: title.trim() || null,
        content: content.trim(),
        mood,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id)
    } else {
      await supabase.from('journal_entries').insert({
        title: title.trim() || null,
        content: content.trim(),
        mood,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
      })
    }
    setSaving(false)
    await loadEntries()
    setView('list')
  }

  async function confirmDelete(id: string) {
    await supabase.from('journal_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeleteTarget(null)
  }

  function startRecording() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e: any) => {
      let final = '', inter = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else inter += e.results[i][0].transcript
      }
      if (final) {
        setContent(prev => {
          const sep = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : ''
          return prev + sep + final
        })
      }
      setInterim(inter)
    }
    rec.onend = () => { setRecording(false); setInterim('') }
    rec.onerror = () => { setRecording(false); setInterim('') }

    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setRecording(false)
    setInterim('')
  }

  // Group entries by month
  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const key = format(parseISO(e.entry_date), 'MMMM yyyy')
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  if (view === 'editor') {
    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { stopRecording(); setView('list') }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-xs text-slate-600">
            {editing ? format(parseISO(editing.entry_date), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}
          </span>
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Entry title (optional)"
          className="w-full bg-transparent text-lg font-semibold text-white placeholder-slate-600 outline-none border-b border-white/8 pb-2"
        />

        {/* Content area */}
        <div className="relative">
          <textarea
            ref={contentRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What's on your mind today?"
            rows={10}
            className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-purple-500/40 resize-none leading-relaxed"
          />
          {interim && (
            <p className="absolute bottom-3 left-4 right-4 text-sm text-purple-400/60 italic pointer-events-none line-clamp-2">
              {interim}…
            </p>
          )}
        </div>

        {/* Voice button */}
        {voiceSupported && (
          <div className="flex items-center gap-3">
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                recording
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse'
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {recording ? 'Stop recording' : 'Speak to journal'}
            </button>
            {recording && (
              <span className="text-xs text-slate-500">Listening… speak naturally</span>
            )}
          </div>
        )}

        {/* Mood */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium">How are you feeling?</p>
          <div className="flex gap-2">
            {MOOD_META.slice(1).map((m, i) => m && (
              <button
                key={i + 1}
                onClick={() => setMood(mood === i + 1 ? null : i + 1)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs transition-all ${
                  mood === i + 1
                    ? 'bg-white/10 border border-white/20'
                    : 'bg-white/3 border border-white/5 opacity-60 hover:opacity-100'
                }`}
              >
                <span className="text-lg">{m.emoji}</span>
                <span className="text-[10px] text-slate-400">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving || !content.trim()}
          className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-2.5 text-sm font-medium text-white transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : editing ? 'Update entry' : 'Save entry'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* New entry button */}
      <button
        onClick={openNew}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-4 text-sm text-slate-500 hover:border-purple-500/40 hover:text-purple-400 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Write a new entry
      </button>

      {/* Entries grouped by month */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-8 text-center">
          <p className="text-sm text-slate-500">No journal entries yet.</p>
          <p className="text-xs text-slate-600 mt-1">Write your first entry above — voice or text.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([month, monthEntries]) => (
          <div key={month} className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide px-1">{month}</p>
            {monthEntries.map(entry => (
              <div key={entry.id} className="group rounded-2xl border border-white/8 bg-white/3 p-4 hover:border-white/12 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(entry)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500">
                        {format(parseISO(entry.entry_date), 'EEE, MMM d')}
                      </span>
                      {entry.mood && MOOD_META[entry.mood] && (
                        <span className="text-sm">{MOOD_META[entry.mood]!.emoji}</span>
                      )}
                    </div>
                    {entry.title && (
                      <p className="text-sm font-semibold text-white mb-1 truncate">{entry.title}</p>
                    )}
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{entry.content}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => openEdit(entry)}
                      className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(entry.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
            <p className="text-base font-semibold text-white">Delete this entry?</p>
            <p className="text-sm text-slate-400">This can't be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteTarget)}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 py-2 text-sm font-medium text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
