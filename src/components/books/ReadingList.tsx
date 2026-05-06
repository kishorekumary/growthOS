'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Star, Sparkles, BookOpen, AlertCircle, GitBranch, Trash2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const BookMindMap = dynamic(() => import('./BookMindMap'), { ssr: false })

type Status = 'want_to_read' | 'reading' | 'completed'

interface Book {
  id: string
  book_title: string
  author: string | null
  genre: string | null
  status: Status
  rating: number | null
  ai_summary: string | null
  key_lessons: string | null
}

interface AiData { summary: string; lessons: string[] }

const STATUS_TABS: { value: Status; label: string; icon: string }[] = [
  { value: 'want_to_read', label: 'Want to Read', icon: '📚' },
  { value: 'reading',      label: 'Reading',      icon: '📖' },
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

function BookDetailDialog({ book, onUpdate, onClose }: { book: Book; onUpdate: () => void; onClose: () => void }) {
  const [aiData, setAiData]       = useState<AiData | null>(parseAi(book.ai_summary))
  const [loadingAi, setLoadingAi] = useState(false)
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
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('reading_log')
      .update({
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
        <DialogTitle className="pr-6">{book.book_title}</DialogTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {book.author && <p className="text-sm text-slate-400">{book.author}</p>}
          {book.genre && (
            <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
              {book.genre}
            </span>
          )}
        </div>
      </DialogHeader>

      <div className="space-y-5">
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

        <Button
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          onClick={saveChanges}
          disabled={saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Changes
        </Button>
      </div>
    </DialogContent>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function ReadingList() {
  const [books, setBooks]               = useState<Book[]>([])
  const [loading, setLoading]           = useState(true)
  const [fetchError, setFetchError]     = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<Status>('want_to_read')
  const [selected, setSelected]         = useState<Book | null>(null)
  const [mindMapBook, setMindMapBook]   = useState<Book | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null)
  const [deleting, setDeleting]         = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('reading_log').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    fetchBooks()
  }

  const fetchBooks = useCallback(async () => {
    setFetchError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }

      const { data, error } = await supabase
        .from('reading_log')
        .select('id, book_title, author, genre, status, rating, ai_summary, key_lessons')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })

      if (error) {
        // key_lessons column missing — fall back without it
        const { data: fallback, error: fallbackError } = await supabase
          .from('reading_log')
          .select('id, book_title, author, genre, status, rating, ai_summary')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
        if (fallbackError) {
          setFetchError(fallbackError.message)
        } else {
          setBooks(((fallback ?? []) as Book[]).map(b => ({ ...b, key_lessons: null })))
        }
      } else {
        setBooks((data as Book[]) ?? [])
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load books')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBooks() }, [fetchBooks])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center space-y-2">
        <AlertCircle className="h-6 w-6 text-red-400 mx-auto" />
        <p className="text-sm text-red-400">Failed to load books</p>
        <p className="text-xs text-red-400/70">{fetchError}</p>
        <button onClick={fetchBooks} className="text-xs text-slate-400 hover:text-white underline">
          Retry
        </button>
      </div>
    )
  }

  const filtered = books.filter(b => b.status === activeStatus)
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
            <p className="text-xs text-slate-500 mt-0.5">{books.length} book{books.length !== 1 ? 's' : ''} tracked</p>
          )}
        </div>
        <AddBookModal onAdd={fetchBooks} />
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
          <p className="text-slate-400 text-sm">No books here yet.</p>
          <p className="text-slate-500 text-xs mt-1">
            {activeStatus === 'want_to_read' ? 'Click "Add Book" to add one manually.' : 'Move a book to this status to see it here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(book => (
            <div
              key={book.id}
              className="group flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
            >
              <button
                type="button"
                onClick={() => setSelected(book)}
                className="flex-1 text-left px-4 py-3.5 min-w-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-8 rounded bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4 text-white/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{book.book_title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {book.author ?? 'Unknown author'}
                      {book.genre ? ` · ${book.genre}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {book.ai_summary && (
                      <span title="Summary available" className="text-violet-400">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {book.key_lessons && book.key_lessons.startsWith('[') && (
                      <span title="Mind map available" className="text-cyan-500">
                        <GitBranch className="h-3.5 w-3.5" />
                      </span>
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
              </button>

              {/* Mind Map button */}
              <button
                type="button"
                onClick={() => setMindMapBook(book)}
                title="Open mind map"
                className="shrink-0 flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-400 opacity-0 group-hover:opacity-100 hover:bg-cyan-500/20 transition-all"
              >
                <GitBranch className="h-3 w-3" />
                Map
              </button>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => setDeleteTarget(book)}
                title="Delete book"
                className="shrink-0 mr-3 flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
          <BookDetailDialog
            book={selected}
            onUpdate={fetchBooks}
            onClose={() => setSelected(null)}
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
          onClose={() => {
            setMindMapBook(null)
            fetchBooks()
          }}
        />
      )}
    </div>
  )
}
