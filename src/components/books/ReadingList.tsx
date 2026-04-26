'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Star, Sparkles, BookOpen } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────

type Status = 'want_to_read' | 'reading' | 'completed'

interface Book {
  id: string
  book_title: string
  author: string | null
  genre: string | null
  status: Status
  rating: number | null
  ai_summary: string | null
}

interface AiData { summary: string; lessons: string[] }

// ─── Constants ───────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────

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
          <Star
            className={cn(
              'h-5 w-5',
              n <= (hover || value || 0)
                ? 'fill-amber-400 text-amber-400'
                : 'text-slate-600'
            )}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Add Book Modal ───────────────────────────────────────────

function AddBookModal({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen]   = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createSupabaseBrowserClient()

  async function handleAdd() {
    if (!title.trim()) return
    setSaving(true)
    await supabase.from('reading_log').insert({
      book_title: title.trim(),
      author: author.trim() || null,
      status: 'want_to_read',
    })
    setTitle(''); setAuthor('')
    setSaving(false)
    setOpen(false)
    onAdd()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
          <Plus className="h-4 w-4" /> Add Book
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Reading List</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Book title</Label>
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
            <Label className="text-slate-300">Author (optional)</Label>
            <Input
              placeholder="e.g. James Clear"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
            />
          </div>
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleAdd}
            disabled={saving || !title.trim()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Book
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Book Detail Dialog ───────────────────────────────────────

function BookDetailDialog({
  book,
  onUpdate,
  onClose,
}: {
  book: Book
  onUpdate: () => void
  onClose: () => void
}) {
  const [aiData, setAiData]       = useState<AiData | null>(parseAi(book.ai_summary))
  const [loadingAi, setLoadingAi] = useState(false)
  const [status, setStatus]       = useState<Status>(book.status)
  const [rating, setRating]       = useState<number | null>(book.rating)
  const [saving, setSaving]       = useState(false)
  const supabase = createSupabaseBrowserClient()

  async function getAiSummary() {
    setLoadingAi(true)
    const res = await fetch('/api/ai/book-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id, title: book.book_title, author: book.author }),
    })
    const data = await res.json()
    setAiData({ summary: data.summary, lessons: data.lessons })
    setLoadingAi(false)
  }

  async function saveChanges() {
    setSaving(true)
    await supabase.from('reading_log')
      .update({
        status,
        rating: status === 'completed' ? rating : null,
        started_at: status === 'reading' && book.status === 'want_to_read'
          ? new Date().toISOString().split('T')[0]
          : undefined,
        finished_at: status === 'completed' && book.status !== 'completed'
          ? new Date().toISOString().split('T')[0]
          : undefined,
        updated_at: new Date().toISOString(),
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
        {book.author && <p className="text-sm text-slate-400">{book.author}</p>}
      </DialogHeader>

      <div className="space-y-5">
        {/* AI Summary */}
        <div className="space-y-2">
          {aiData ? (
            <>
              <p className="text-sm text-slate-300 leading-relaxed">{aiData.summary}</p>
              {aiData.lessons.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold text-violet-400">Key Lessons</p>
                  {aiData.lessons.map((lesson, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-violet-400 mt-0.5 shrink-0">{i + 1}.</span>
                      {lesson}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Button
              size="sm"
              onClick={getAiSummary}
              disabled={loadingAi}
              className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 gap-1.5"
            >
              {loadingAi
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Getting summary...</>
                : <><Sparkles className="h-3.5 w-3.5" /> Get AI Summary & Lessons</>
              }
            </Button>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Status</Label>
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

        {/* Rating */}
        {status === 'completed' && (
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Your Rating</Label>
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
  const [books, setBooks]         = useState<Book[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeStatus, setActiveStatus] = useState<Status>('want_to_read')
  const [selected, setSelected]   = useState<Book | null>(null)
  const supabase = createSupabaseBrowserClient()

  const fetchBooks = useCallback(async () => {
    const { data } = await supabase
      .from('reading_log')
      .select('*')
      .order('updated_at', { ascending: false })
    setBooks((data as Book[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchBooks() }, [fetchBooks])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
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
        <h2 className="font-semibold text-white">My Reading List</h2>
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
              activeStatus === value
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {icon} {label}
            {counts[value] > 0 && (
              <span className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-xs',
                activeStatus === value ? 'bg-white/20' : 'bg-white/10'
              )}>
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
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(book => (
            <button
              key={book.id}
              type="button"
              onClick={() => setSelected(book)}
              className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 hover:border-white/20 hover:bg-white/8 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-8 rounded bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4 text-white/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{book.book_title}</p>
                  {book.author && <p className="text-xs text-slate-500 truncate">{book.author}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {book.genre && (
                    <span className="hidden sm:block text-xs bg-white/10 text-slate-400 px-2 py-0.5 rounded-full">
                      {book.genre}
                    </span>
                  )}
                  {book.status === 'completed' && book.rating && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: book.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  )}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_STYLES[book.status])}>
                    {STATUS_TABS.find(t => t.value === book.status)?.icon}
                  </span>
                </div>
              </div>
            </button>
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
    </div>
  )
}
