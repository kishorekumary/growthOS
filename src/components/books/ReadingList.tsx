'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Plus, Star, Sparkles, BookOpen, AlertCircle, GitBranch, Trash2, Quote, Scroll, Globe } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const BookMindMap   = dynamic(() => import('./BookMindMap'),   { ssr: false })
const BookInsights  = dynamic(() => import('./BookInsights'),  { ssr: false })

type Status = 'want_to_read' | 'reading' | 'completed'

interface Book {
  id: string
  user_id: string
  book_title: string
  author: string | null
  genre: string | null
  status: Status
  rating: number | null
  ai_summary: string | null
  key_lessons: string | null
  quotes: string | null
  stories: string | null
  is_global: boolean
}

interface AiData { summary: string; lessons: string[] }

const STATUS_TABS: { value: Status; label: string; icon: string }[] = [
  { value: 'reading',      label: 'Reading',      icon: '📖' },
  { value: 'want_to_read', label: 'Want to Read', icon: '📚' },
  { value: 'completed',    label: 'Completed',    icon: '✅' },
]

const STATUS_STYLES: Record<Status, string> = {
  want_to_read: 'bg-slate-500/20 text-slate-300',
  reading:      'bg-sky-500/20 text-sky-300',
  completed:    'bg-emerald-500/20 text-emerald-300',
}

const GENRES = ['Self-Help', 'Business', 'Psychology', 'Philosophy', 'Science', 'Biography', 'History', 'Fiction', 'Productivity', 'Non-Fiction']

function parseAi(raw: string | null): AiData | null {
  if (!raw) return null
  try { return JSON.parse(raw) as AiData }
  catch { return { summary: raw, lessons: [] } }
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star className={cn('h-5 w-5', n <= (hover || value || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-600')} />
        </button>
      ))}
    </div>
  )
}

// ─── Add Book Modal ───────────────────────────────────────────

function AddBookModal({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen]     = useState(false)
  const [title, setTitle]   = useState('')
  const [author, setAuthor] = useState('')
  const [genre, setGenre]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleAdd() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setError('Not signed in. Please refresh and try again.')
      setSaving(false)
      return
    }
    const { error: insertError } = await supabase.from('reading_log').insert({
      user_id:    session.user.id,
      book_title: title.trim(),
      author:     author.trim() || null,
      genre:      genre || null,
      status:     'want_to_read',
    })
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    setTitle(''); setAuthor(''); setGenre('')
    setSaving(false)
    setOpen(false)
    onAdd()
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setError(null) }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
          <Plus className="h-4 w-4" /> Add Book
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Book Manually</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Book title *</Label>
            <Input
              autoFocus
              placeholder="e.g. Atomic Habits"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Author</Label>
            <Input
              placeholder="e.g. James Clear"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Genre</Label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(genre === g ? '' : g)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-all',
                    genre === g
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleAdd}
            disabled={saving || !title.trim()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add to Reading List
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Book Detail Dialog ───────────────────────────────────────

function BookDetailDialog({ book, onUpdate, onClose, readonly = false }: { book: Book; onUpdate: () => void; onClose: () => void; readonly?: boolean }) {
  const [aiData, setAiData]       = useState<AiData | null>(parseAi(book.ai_summary))
  const [loadingAi, setLoadingAi] = useState(false)
  const [title, setTitle]         = useState(book.book_title)
  const [author, setAuthor]       = useState(book.author ?? '')
  const [genre, setGenre]         = useState(book.genre ?? '')
  const [status, setStatus]       = useState<Status>(book.status)
  const [rating, setRating]       = useState<number | null>(book.rating)
  const [saving, setSaving]       = useState(false)

  // Auto-fetch summary if not already cached
  useEffect(() => {
    if (!aiData && !loadingAi) fetchSummary()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSummary() {
    setLoadingAi(true)
    const res = await fetch('/api/ai/book-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id, title: book.book_title, author: book.author }),
    })
    const data = await res.json()
    if (data.summary) setAiData({ summary: data.summary, lessons: data.lessons ?? [] })
    setLoadingAi(false)
  }

  async function saveChanges() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('reading_log')
      .update({
        book_title:  title.trim(),
        author:      author.trim() || null,
        genre:       genre || null,
        status,
        rating:      status === 'completed' ? rating : null,
        started_at:  status === 'reading' && book.status === 'want_to_read'
          ? new Date().toISOString().split('T')[0] : undefined,
        finished_at: status === 'completed' && book.status !== 'completed'
          ? new Date().toISOString().split('T')[0] : undefined,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', book.id)
    setSaving(false)
    onUpdate()
    onClose()
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="pr-6">Edit Book</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        {/* Global read-only notice */}
        {readonly && (
          <div className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/8 px-3 py-2.5">
            <Globe className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <p className="text-xs text-sky-300">This is a global book — view only</p>
          </div>
        )}

        {/* Title / Author / Genre */}
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/3 p-4">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Title *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Book title"
              className="border-white/15 bg-white/5 text-white placeholder:text-slate-600 focus-visible:ring-white/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Author</Label>
            <Input
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="e.g. James Clear"
              className="border-white/15 bg-white/5 text-white placeholder:text-slate-600 focus-visible:ring-white/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Genre</Label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(genre === g ? '' : g)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-all',
                    genre === g
                      ? 'border-white/30 bg-white/15 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Summary */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-violet-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Book Summary
          </p>
          {loadingAi ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={cn('h-3 rounded-full bg-white/10 animate-pulse', i === 3 ? 'w-2/3' : 'w-full')} />
              ))}
            </div>
          ) : aiData ? (
            <>
              <p className="text-sm text-slate-300 leading-relaxed">{aiData.summary}</p>
              {aiData.lessons.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  <p className="text-xs font-semibold text-violet-400">Key Lessons</p>
                  {aiData.lessons.map((lesson, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-violet-400 shrink-0 mt-0.5">{i + 1}.</span>
                      {lesson}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={fetchSummary}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Refresh summary
              </button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={fetchSummary}
              className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> Get Summary & Key Lessons
            </Button>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Reading status</Label>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_TABS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={cn(
                  'rounded-lg border py-2 text-xs font-medium transition-all',
                  status === value
                    ? 'border-violet-500 bg-violet-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                )}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {status === 'completed' && (
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Your rating</Label>
            <StarRating value={rating} onChange={setRating} />
          </div>
        )}

        {!readonly && (
          <Button
            className="w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white"
            onClick={saveChanges}
            disabled={saving || !title.trim()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        )}
      </div>
    </DialogContent>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function ReadingList() {
  const {
    data: books,
    loading,
    isOffline,
    setData: setBooks,
    refetch: refetchBooks,
  } = useCachedQuery<Book[]>(
    'reading_log',
    async (supabase, userId) => {
      const primary = await supabase
        .from('reading_log')
        .select('id, user_id, book_title, author, genre, status, rating, ai_summary, key_lessons, quotes, stories, is_global')
        .or(`user_id.eq.${userId},is_global.eq.true`)
        .order('is_global', { ascending: false }) // global books first
        .order('updated_at', { ascending: false })
      if (!primary.error) return primary

      // Fallback: is_global column may not exist yet
      const fallback = await supabase
        .from('reading_log')
        .select('id, user_id, book_title, author, genre, status, rating, ai_summary, key_lessons, quotes, stories')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (fallback.error) return fallback
      return {
        data: ((fallback.data ?? []) as Omit<Book, 'is_global'>[]).map(b => ({ ...b, is_global: false })),
        error: null,
      }
    },
    [],
    []
  )

  const { data: profile } = useCachedQuery<{ is_admin: boolean } | null>(
    'reading-list:profile',
    (supabase, userId) => supabase.from('user_profiles').select('is_admin').eq('id', userId).single(),
    null,
    []
  )
  const isAdmin = profile?.is_admin ?? false

  const [activeStatus, setActiveStatus] = useState<Status>('reading')
  const [selected, setSelected]         = useState<Book | null>(null)
  const [mindMapBook, setMindMapBook]         = useState<Book | null>(null)
  const [mindMapReadonly, setMindMapReadonly] = useState(false)
  const [insightsBook, setInsightsBook]       = useState<Book | null>(null)
  const [insightsTab, setInsightsTab]         = useState<'quotes' | 'stories'>('quotes')
  const [deleteTarget, setDeleteTarget]       = useState<Book | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [currentUserId, setCurrentUserId]     = useState<string | null>(null)
  const [togglingGlobalId, setTogglingGlobalId] = useState<string | null>(null)

  // Resolve current user id for ownership checks (books/globals may include other users' rows)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null)
    })
  }, [])

  async function toggleGlobal(book: Book) {
    if (togglingGlobalId) return
    setTogglingGlobalId(book.id)
    const next = !book.is_global
    const res = await fetch(`/api/admin/global-books?id=${book.id}&global=${next}`, { method: 'PATCH' })
    if (res.ok) setBooks(prev => prev.map(b => b.id === book.id ? { ...b, is_global: next } : b))
    setTogglingGlobalId(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('reading_log').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    refetchBooks()
  }

  // Highlight a specific book when navigated from search
  const highlightRef = useRef<string | null>(null)
  useEffect(() => {
    highlightRef.current = new URLSearchParams(window.location.search).get('highlight')
  }, [])

  useEffect(() => {
    if (!books.length || !highlightRef.current) return
    const id = highlightRef.current
    highlightRef.current = null  // consume so it only fires once
    const book = books.find(b => b.id === id)
    if (!book) return
    // Switch to correct status tab then open the mindmap directly
    setActiveStatus(book.status)
    setTimeout(() => {
      setMindMapReadonly(book.user_id !== currentUserId)
      setMindMapBook(book)
    }, 80)
  }, [books])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const isOwner = (book: Book) => book.user_id === currentUserId
  const filtered = books.filter(b => b.status === activeStatus)
  const globalCount = books.filter(b => b.is_global && !isOwner(b)).length
  const counts: Record<Status, number> = {
    want_to_read: books.filter(b => b.status === 'want_to_read').length,
    reading:      books.filter(b => b.status === 'reading').length,
    completed:    books.filter(b => b.status === 'completed').length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">My Reading List</h2>
          {books.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {books.filter(b => isOwner(b)).length} book{books.filter(b => isOwner(b)).length !== 1 ? 's' : ''} tracked
              {globalCount > 0 && <span> · <Globe className="inline h-3 w-3 text-sky-400 mb-0.5" /> {globalCount} global</span>}
            </p>
          )}
        </div>
        <AddBookModal onAdd={refetchBooks} />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {STATUS_TABS.map(({ value, label, icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveStatus(value)}
            className={cn(
              'flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all',
              activeStatus === value ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            )}
          >
            {icon} {label}
            {counts[value] > 0 && (
              <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs', activeStatus === value ? 'bg-white/20' : 'bg-white/10')}>
                {counts[value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Book list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
          <BookOpen className="h-8 w-8 text-violet-400/30 mx-auto mb-2" />
          {books.length === 0 && isOffline ? (
            <p className="text-slate-400 text-sm">Can&apos;t load — you&apos;re offline.</p>
          ) : (
            <>
              <p className="text-slate-400 text-sm">No books here yet.</p>
              <p className="text-slate-500 text-xs mt-1">
                {activeStatus === 'want_to_read' ? 'Click "Add Book" to add one manually.' : 'Move a book to this status to see it here.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(book => {
          const owned = isOwner(book)
          return (
            <div
              key={book.id}
              id={`book-${book.id}`}
              className={cn(
                'group flex items-center gap-1 rounded-xl border bg-white/5 transition-all duration-300',
                book.is_global
                  ? 'border-sky-500/25 hover:border-sky-500/50 hover:bg-sky-500/5'
                  : 'border-white/10 hover:border-violet-500/30 hover:bg-violet-500/5',
              )}
            >
              <div className="flex-1 flex items-center gap-3 px-4 py-3.5 min-w-0">
                {/* Book icon — opens detail/overview/edit */}
                <button
                  type="button"
                  title="View details"
                  onClick={() => setSelected(book)}
                  className={cn(
                    'h-10 w-8 rounded flex items-center justify-center shrink-0 transition-opacity hover:opacity-75',
                    book.is_global
                      ? 'bg-gradient-to-br from-sky-600 to-sky-800'
                      : 'bg-gradient-to-br from-violet-600 to-violet-800',
                  )}
                >
                  <BookOpen className="h-4 w-4 text-white/70" />
                </button>

                {/* Title/author area — opens mindmap */}
                <button
                  type="button"
                  onClick={() => { setMindMapReadonly(!owned); setMindMapBook(book) }}
                  className="flex-1 min-w-0 flex flex-col items-start gap-0.5 text-left"
                >
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    <p className="text-sm font-medium text-white truncate min-w-0">{book.book_title}</p>
                    {book.is_global && (
                      <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5">
                        <Globe className="h-2.5 w-2.5 text-sky-400" />
                        <span className="text-[9px] font-medium text-sky-400">Global</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate w-full">
                    {book.author ?? 'Unknown author'}
                    {book.genre ? ` · ${book.genre}` : ''}
                  </p>
                </button>

                {/* Icon badges — outside the mindmap button so they don't trigger it */}
                <div className="flex items-center gap-2 shrink-0">
                  {book.ai_summary && (
                    <span title="Summary available" className="text-violet-400">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {book.key_lessons && book.key_lessons.startsWith('[') && (
                    <span title="Has mind map" className="text-cyan-500">
                      <GitBranch className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {book.quotes && book.quotes.startsWith('[') && (
                    <button
                      type="button"
                      title="View quotes"
                      onClick={e => { e.stopPropagation(); setInsightsTab('quotes'); setInsightsBook(book) }}
                      className="text-amber-500 hover:text-amber-300 transition-colors"
                    >
                      <Quote className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {book.stories && book.stories.startsWith('[') && (
                    <button
                      type="button"
                      title="View stories"
                      onClick={e => { e.stopPropagation(); setInsightsTab('stories'); setInsightsBook(book) }}
                      className="text-violet-500 hover:text-violet-300 transition-colors"
                    >
                      <Scroll className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {book.status === 'completed' && book.rating && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: book.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  )}
                </div>
              </div>


              {/* Quotes button — desktop hover only, hidden on mobile (icon badge handles it) */}
              <button
                type="button"
                onClick={() => { setInsightsTab('quotes'); setInsightsBook(book) }}
                title="Open quotes"
                className="hidden md:flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400 opacity-0 group-hover:opacity-100 hover:bg-amber-500/20 transition-all"
              >
                <Quote className="h-3 w-3" />
                Quotes
              </button>

              {/* Stories button — desktop hover only, hidden on mobile */}
              <button
                type="button"
                onClick={() => { setInsightsTab('stories'); setInsightsBook(book) }}
                title="Open stories"
                className="hidden md:flex shrink-0 items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-medium text-violet-400 opacity-0 group-hover:opacity-100 hover:bg-violet-500/20 transition-all"
              >
                <Scroll className="h-3 w-3" />
                Stories
              </button>

              {/* Admin: globe toggle (own books only) */}
              {isAdmin && owned && (
                <button
                  type="button"
                  onClick={() => toggleGlobal(book)}
                  disabled={!!togglingGlobalId}
                  title={book.is_global ? 'Remove from global' : 'Share globally'}
                  className={cn(
                    'shrink-0 flex items-center justify-center rounded-lg border p-1.5 opacity-0 group-hover:opacity-100 transition-all',
                    book.is_global
                      ? 'border-sky-500/40 bg-sky-500/15 text-sky-400 hover:bg-sky-500/25'
                      : 'border-white/10 bg-white/5 text-slate-500 hover:text-sky-400 hover:border-sky-500/30',
                  )}
                >
                  {togglingGlobalId === book.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Globe className="h-3.5 w-3.5" />}
                </button>
              )}

              {/* Delete — only for books the user owns */}
              {owned && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(book)}
                  title="Delete book"
                  className="shrink-0 mr-3 flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Spacer for global books (no delete) */}
              {!owned && <div className="mr-3" />}
            </div>
          )
        })}
        </div>
      )}

      {/* Detail dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
          <BookDetailDialog
            book={selected}
            onUpdate={refetchBooks}
            onClose={() => setSelected(null)}
            readonly={selected.is_global && !isOwner(selected)}
          />
        </Dialog>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete book?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">
            <span className="text-white font-medium">{deleteTarget?.book_title}</span> will be permanently removed from your reading list.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mind Map overlay */}
      {mindMapBook && (
        <BookMindMap
          bookId={mindMapBook.id}
          bookTitle={mindMapBook.book_title}
          initialJson={mindMapBook.key_lessons}
          readonly={mindMapReadonly}
          onClose={() => {
            setMindMapBook(null)
            refetchBooks()
          }}
        />
      )}

      {/* Quotes / Stories overlay */}
      {insightsBook && (
        <BookInsights
          bookId={insightsBook.id}
          bookTitle={insightsBook.book_title}
          initialQuotes={insightsBook.quotes}
          initialStories={insightsBook.stories}
          initialTab={insightsTab}
          onClose={() => {
            setInsightsBook(null)
            refetchBooks()
          }}
        />
      )}
    </div>
  )
}
