'use client'

import { useState, useRef } from 'react'
import { X, Plus, Trash2, Check, Loader2, Pencil, Quote, Scroll, EyeOff, Eye, ClipboardList } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import RichTextEditor from '@/components/shared/RichTextEditor'

// ── Data types ────────────────────────────────────────────────

interface QuoteEntry {
  id: string
  text: string
  source: string   // e.g. "Chapter 3", "Page 42" — optional context
}

interface StoryEntry {
  id: string
  title: string
  text: string
}

type Tab = 'quotes' | 'stories'

// ── Helpers ───────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) }

function parseQuotes(json: string | null): QuoteEntry[] {
  if (!json) return []
  try { const p = JSON.parse(json); return Array.isArray(p) ? p : [] } catch { return [] }
}

function parseStories(json: string | null): StoryEntry[] {
  if (!json) return []
  try { const p = JSON.parse(json); return Array.isArray(p) ? p : [] } catch { return [] }
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  bookId: string
  bookTitle: string
  initialQuotes: string | null
  initialStories: string | null
  readonly?: boolean
  initialTab?: Tab
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────

export default function BookInsights({
  bookId, bookTitle,
  initialQuotes, initialStories,
  readonly: readonlyProp = false,
  initialTab = 'quotes',
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [quotes, setQuotes]   = useState<QuoteEntry[]>(() => parseQuotes(initialQuotes))
  const [stories, setStories] = useState<StoryEntry[]>(() => parseStories(initialStories))
  const [isReadOnly, setIsReadOnly] = useState(readonlyProp)

  // Edit state — one item at a time
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editQuote, setEditQuote]   = useState<QuoteEntry>({ id: '', text: '', source: '' })
  const [editStory, setEditStory]   = useState<StoryEntry>({ id: '', title: '', text: '' })

  const [saving, setSaving]         = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [isDirty, setIsDirty]       = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [bulkMode, setBulkMode]     = useState(false)
  const [bulkText, setBulkText]     = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Save ─────────────────────────────────────────────────────

  async function save() {
    setSaving(true); setSaveError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase
      .from('reading_log')
      .update({
        quotes:  JSON.stringify(quotes),
        stories: JSON.stringify(stories),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookId)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setIsDirty(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  function handleClose() {
    if (isDirty && !isReadOnly) { setShowCloseConfirm(true); return }
    onClose()
  }

  // ── Quote helpers ─────────────────────────────────────────────

  function startAddQuote() {
    const id = uid()
    setEditingId(id)
    setEditQuote({ id, text: '', source: '' })
  }

  function startEditQuote(q: QuoteEntry) {
    setEditingId(q.id)
    setEditQuote({ ...q })
  }

  function commitQuote() {
    if (!editQuote.text.trim()) { cancelEdit(); return }
    const exists = quotes.some(q => q.id === editQuote.id)
    if (exists) {
      setQuotes(prev => prev.map(q => q.id === editQuote.id ? { ...editQuote, text: editQuote.text.trim(), source: editQuote.source.trim() } : q))
    } else {
      setQuotes(prev => [...prev, { ...editQuote, text: editQuote.text.trim(), source: editQuote.source.trim() }])
    }
    setIsDirty(true)
    cancelEdit()
  }

  function deleteQuote(id: string) {
    setQuotes(prev => prev.filter(q => q.id !== id))
    setIsDirty(true)
  }

  // ── Story helpers ─────────────────────────────────────────────

  function startAddStory() {
    const id = uid()
    setEditingId(id)
    setEditStory({ id, title: '', text: '' })
  }

  function startEditStory(s: StoryEntry) {
    setEditingId(s.id)
    setEditStory({ ...s })
  }

  function commitStory() {
    if (!editStory.text.trim() && !editStory.title.trim()) { cancelEdit(); return }
    const exists = stories.some(s => s.id === editStory.id)
    const committed: StoryEntry = {
      ...editStory,
      title: editStory.title.trim() || 'Untitled story',
      text: editStory.text.trim(),
    }
    if (exists) {
      setStories(prev => prev.map(s => s.id === editStory.id ? committed : s))
    } else {
      setStories(prev => [...prev, committed])
    }
    setIsDirty(true)
    cancelEdit()
  }

  function deleteStory(id: string) {
    setStories(prev => prev.filter(s => s.id !== id))
    setIsDirty(true)
  }

  function cancelEdit() { setEditingId(null) }

  function commitBulk() {
    // Split on blank lines; each block = one quote.
    // Optional last line starting with — or - becomes the source.
    const blocks = bulkText.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
    if (blocks.length === 0) { setBulkMode(false); return }
    const parsed: QuoteEntry[] = blocks.map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
      const lastLine = lines[lines.length - 1]
      const isSource = lines.length > 1 && /^[—–-]/.test(lastLine)
      return {
        id:     uid(),
        text:   isSource ? lines.slice(0, -1).join('\n') : lines.join('\n'),
        source: isSource ? lastLine.replace(/^[—–-]\s*/, '') : '',
      }
    })
    setQuotes(prev => [...prev, ...parsed])
    setIsDirty(true)
    setBulkText('')
    setBulkMode(false)
  }

  // ── Render ────────────────────────────────────────────────────

  const activeQuoteEdit  = tab === 'quotes'  && editingId !== null
  const activeStoryEdit  = tab === 'stories' && editingId !== null
  const isNewItem        = tab === 'quotes'
    ? activeQuoteEdit  && !quotes.some(q => q.id === editingId)
    : activeStoryEdit && !stories.some(s => s.id === editingId)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#07070f]/97 backdrop-blur-md">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-slate-500 shrink-0">Insights</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-sm font-semibold text-white truncate">{bookTitle}</span>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/8 p-0.5">
          <button
            onClick={() => { setTab('quotes'); cancelEdit() }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              tab === 'quotes'
                ? 'bg-white/10 text-white border border-white/15'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Quote className="h-3 w-3" />
            Quotes
            {quotes.length > 0 && (
              <span className="ml-0.5 text-[10px] tabular-nums opacity-70">{quotes.length}</span>
            )}
          </button>
          <button
            onClick={() => { setTab('stories'); cancelEdit() }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              tab === 'stories'
                ? 'bg-white/10 text-white border border-white/15'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Scroll className="h-3 w-3" />
            Stories
            {stories.length > 0 && (
              <span className="ml-0.5 text-[10px] tabular-nums opacity-70">{stories.length}</span>
            )}
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setIsReadOnly(r => !r); cancelEdit() }}
            title={isReadOnly ? 'Switch to edit mode' : 'Switch to read-only mode'}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all',
              isReadOnly
                ? 'bg-white/8 border-white/15 text-slate-200 hover:bg-white/12'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            )}
          >
            {isReadOnly ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {isReadOnly ? 'Read Only' : 'View'}
          </button>

          {!isReadOnly && (
            <button
              onClick={save}
              disabled={saving}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                savedFlash
                  ? 'bg-emerald-600/80 text-white'
                  : 'bg-white/8 border border-white/15 text-white hover:bg-white/12 disabled:opacity-40'
              )}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" />
                : savedFlash ? <Check className="h-3 w-3" /> : null}
              {savedFlash ? 'Saved!' : 'Save'}
            </button>
          )}

          <button onClick={handleClose} className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {saveError && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20 shrink-0">
          {saveError}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">

          {/* ── QUOTES TAB ── */}
          {tab === 'quotes' && (
            <>
              {/* ── Bulk paste mode ── */}
              {bulkMode && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      Paste all your quotes here. Separate each quote with a <strong className="text-white">blank line</strong>.<br />
                      Optionally add <code className="text-amber-300">— Source</code> as the last line of a quote block.
                    </p>
                    <button onClick={() => { setBulkMode(false); setBulkText('') }}
                      className="shrink-0 ml-4 text-slate-500 hover:text-white transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    autoFocus
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={`The only way to do great work is to love what you do.\n— Steve Jobs\n\nIn the middle of every difficulty lies opportunity.\n\nIt always seems impossible until it's done.\n— Nelson Mandela`}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-700 resize-none focus:outline-none focus:border-white/20 leading-relaxed font-mono"
                    style={{ minHeight: 'calc(100vh - 280px)' }}
                  />
                  <div className="flex gap-2">
                    <button onClick={commitBulk}
                      disabled={!bulkText.trim()}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-white/8 border border-white/15 text-white hover:bg-white/12 disabled:opacity-40 transition-colors">
                      <Check className="h-4 w-4" /> Add {bulkText.trim() ? bulkText.split(/\n{2,}/).filter(b => b.trim()).length : 0} quote{bulkText.split(/\n{2,}/).filter(b => b.trim()).length !== 1 ? 's' : ''}
                    </button>
                    <button onClick={() => { setBulkMode(false); setBulkText('') }}
                      className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-white transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!bulkMode && quotes.length === 0 && !activeQuoteEdit && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Quote className="h-10 w-10 text-slate-700 mb-3" />
                  <p className="text-sm text-slate-500">No quotes yet.</p>
                  {!isReadOnly && <p className="text-xs text-slate-600 mt-1">Paste all at once or add one by one below.</p>}
                </div>
              )}

              {!bulkMode && quotes.map(q => (
                <div
                  key={q.id}
                  className={cn(
                    'group rounded-xl border border-white/8 bg-white/3 px-5 py-4 transition-all',
                    editingId === q.id ? 'border-white/20 bg-white/5' : 'hover:border-white/12 hover:bg-white/5'
                  )}
                >
                  {editingId === q.id ? (
                    <div className="space-y-3">
                      <textarea
                        autoFocus
                        value={editQuote.text}
                        onChange={e => setEditQuote(prev => ({ ...prev, text: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                        placeholder="Type the quote…"
                        rows={3}
                        className="w-full bg-transparent text-sm text-amber-100 placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed italic"
                      />
                      <input
                        value={editQuote.source}
                        onChange={e => setEditQuote(prev => ({ ...prev, source: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') commitQuote(); if (e.key === 'Escape') cancelEdit() }}
                        placeholder="Source (e.g. Chapter 3, Page 42) — optional"
                        className="w-full bg-transparent text-xs text-slate-500 placeholder:text-slate-700 focus:outline-none border-t border-white/8 pt-2"
                      />
                      <div className="flex gap-2 pt-1">
                        <button onClick={commitQuote} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-white/8 border border-white/15 text-slate-200 hover:bg-white/15 transition-colors">
                          <Check className="h-3 w-3" /> Save
                        </button>
                        <button onClick={cancelEdit} className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:text-white transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Quote className="h-4 w-4 text-amber-500/60 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-amber-200 leading-relaxed italic whitespace-pre-wrap">{q.text}</p>
                        {q.source && (
                          <p className="mt-1.5 text-xs text-slate-600">— {q.source}</p>
                        )}
                      </div>
                      {!isReadOnly && (
                        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => startEditQuote(q)} className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteQuote(q.id)} className="p-1 rounded text-slate-700 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Inline new-quote form */}
              {!bulkMode && activeQuoteEdit && isNewItem && (
                <div className="rounded-xl border border-white/10 bg-white/3 px-5 py-4 space-y-3">
                  <textarea
                    autoFocus
                    ref={textareaRef}
                    value={editQuote.text}
                    onChange={e => setEditQuote(prev => ({ ...prev, text: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                    placeholder="Type the quote…"
                    rows={3}
                    className="w-full bg-transparent text-sm text-amber-100 placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed italic"
                  />
                  <input
                    value={editQuote.source}
                    onChange={e => setEditQuote(prev => ({ ...prev, source: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') commitQuote(); if (e.key === 'Escape') cancelEdit() }}
                    placeholder="Source (e.g. Chapter 3, Page 42) — optional"
                    className="w-full bg-transparent text-xs text-slate-500 placeholder:text-slate-700 focus:outline-none border-t border-white/8 pt-2"
                  />
                  <div className="flex gap-2 pt-1">
                    <button onClick={commitQuote} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-white/8 border border-white/15 text-slate-200 hover:bg-white/15 transition-colors">
                      <Check className="h-3 w-3" /> Add
                    </button>
                    <button onClick={cancelEdit} className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:text-white transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!isReadOnly && !activeQuoteEdit && !bulkMode && (
                <div className="flex gap-2">
                  <button
                    onClick={startAddQuote}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3.5 text-sm text-slate-600 hover:text-slate-300 hover:border-white/20 transition-all"
                  >
                    <Plus className="h-4 w-4" /> Add one
                  </button>
                  <button
                    onClick={() => { cancelEdit(); setBulkText(''); setBulkMode(true) }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-amber-500/20 py-3.5 text-sm text-amber-600/70 hover:text-amber-400 hover:border-amber-500/40 transition-all"
                  >
                    <ClipboardList className="h-4 w-4" /> Paste all
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── STORIES TAB ── */}
          {tab === 'stories' && (
            <>
              {stories.length === 0 && !activeStoryEdit && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Scroll className="h-10 w-10 text-slate-700 mb-3" />
                  <p className="text-sm text-slate-500">No stories yet.</p>
                  {!isReadOnly && <p className="text-xs text-slate-600 mt-1">Click &ldquo;Add Story&rdquo; to capture an interesting anecdote.</p>}
                </div>
              )}

              {stories.map(s => (
                <div
                  key={s.id}
                  className={cn(
                    'group rounded-xl border border-white/8 bg-white/3 px-5 py-4 transition-all',
                    editingId === s.id ? 'border-white/20 bg-white/5' : 'hover:border-white/12 hover:bg-white/5'
                  )}
                >
                  {editingId === s.id ? (
                    <div className="space-y-3">
                      <input
                        autoFocus
                        value={editStory.title}
                        onChange={e => setEditStory(prev => ({ ...prev, title: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                        placeholder="Story title…"
                        className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-slate-600 focus:outline-none"
                      />
                      <RichTextEditor
                        value={editStory.text}
                        onChange={html => setEditStory(prev => ({ ...prev, text: html }))}
                        placeholder="Describe the story or anecdote…"
                        className="border-t border-white/8 rounded-none border-x-0 border-b-0 bg-transparent"
                      />
                      <div className="flex gap-2 pt-1">
                        <button onClick={commitStory} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-white/8 border border-white/15 text-slate-200 hover:bg-white/15 transition-colors">
                          <Check className="h-3 w-3" /> Save
                        </button>
                        <button onClick={cancelEdit} className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:text-white transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Scroll className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white mb-1.5">{s.title}</p>
                        <div className="rich-display text-sm text-slate-100" dangerouslySetInnerHTML={{ __html: s.text }} /></div>
                      {!isReadOnly && (
                        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => startEditStory(s)} className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteStory(s.id)} className="p-1 rounded text-slate-700 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Inline new-story form */}
              {activeStoryEdit && isNewItem && (
                <div className="rounded-xl border border-white/10 bg-white/3 px-5 py-4 space-y-3">
                  <input
                    autoFocus
                    value={editStory.title}
                    onChange={e => setEditStory(prev => ({ ...prev, title: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                    placeholder="Story title…"
                    className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-slate-600 focus:outline-none"
                  />
                  <RichTextEditor
                    value={editStory.text}
                    onChange={html => setEditStory(prev => ({ ...prev, text: html }))}
                    placeholder="Describe the story or anecdote…"
                    className="border-t border-white/8 rounded-none border-x-0 border-b-0 bg-transparent"
                  />
                  <div className="flex gap-2 pt-1">
                    <button onClick={commitStory} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-white/8 border border-white/15 text-slate-200 hover:bg-white/15 transition-colors">
                      <Check className="h-3 w-3" /> Add
                    </button>
                    <button onClick={cancelEdit} className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:text-white transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!isReadOnly && !activeStoryEdit && (
                <button
                  onClick={startAddStory}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3.5 text-sm text-slate-600 hover:text-slate-300 hover:border-white/20 transition-all"
                >
                  <Plus className="h-4 w-4" /> Add Story
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Unsaved changes confirm ── */}
      {showCloseConfirm && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/12 bg-slate-900 shadow-2xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold text-white mb-1">Unsaved changes</p>
            <p className="text-xs text-slate-400 mb-5">You have unsaved changes. Save before closing?</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowCloseConfirm(false); onClose() }} className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5 transition-colors">
                Discard
              </button>
              <button onClick={async () => { await save(); setShowCloseConfirm(false); onClose() }} className="flex-1 rounded-lg bg-white/10 border border-white/20 py-2 text-sm text-white hover:bg-white/15 transition-colors">
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
