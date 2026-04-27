'use client'

import { useState } from 'react'
import { Loader2, Sparkles, BookOpen, Check } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RecommendedBook {
  title: string
  author: string
  genre: string
  reason: string
  key_lesson: string
}

const GENRE_COLORS: Record<string, string> = {
  'Self-Help':    'bg-violet-500/20 text-violet-300',
  'Non-Fiction':  'bg-sky-500/20 text-sky-300',
  'Business':     'bg-emerald-500/20 text-emerald-300',
  'Science':      'bg-teal-500/20 text-teal-300',
  'History':      'bg-amber-500/20 text-amber-300',
  'Philosophy':   'bg-purple-500/20 text-purple-300',
  'Psychology':   'bg-pink-500/20 text-pink-300',
  'Fiction':      'bg-orange-500/20 text-orange-300',
  'Biography':    'bg-yellow-500/20 text-yellow-300',
  'Productivity': 'bg-lime-500/20 text-lime-300',
}

function genreStyle(genre: string) {
  return GENRE_COLORS[genre] ?? 'bg-slate-500/20 text-slate-300'
}

const COVER_COLORS = [
  'from-violet-600 to-violet-800',
  'from-sky-600 to-sky-800',
  'from-emerald-600 to-emerald-800',
  'from-orange-600 to-orange-800',
  'from-pink-600 to-pink-800',
  'from-teal-600 to-teal-800',
]

function BookCover({ title, index }: { title: string; index: number }) {
  const initials = title
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || title.slice(0, 2).toUpperCase()
  const gradient = COVER_COLORS[index % COVER_COLORS.length]

  return (
    <div className={cn(
      'aspect-[2/3] w-full rounded-lg bg-gradient-to-br flex items-center justify-center',
      gradient
    )}>
      <span className="text-2xl font-bold text-white/80">{initials}</span>
    </div>
  )
}

export default function BookDiscover() {
  const [books, setBooks]   = useState<RecommendedBook[]>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]   = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState<number | null>(null)
  async function getRecommendations() {
    setLoading(true)
    setSaved(new Set())
    const res = await fetch('/api/ai/book-recommendations', { method: 'POST' })
    const data = await res.json()
    setBooks(data.books ?? [])
    setLoading(false)
  }

  async function saveBook(book: RecommendedBook, idx: number) {
    setSaving(idx)
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await supabase.from('reading_log').insert({
        user_id: session.user.id,
        book_title: book.title,
        author: book.author,
        genre: book.genre,
        status: 'want_to_read',
      })
    }
    setSaved(prev => new Set(Array.from(prev).concat(idx)))
    setSaving(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Discover Books</h2>
          <p className="text-xs text-slate-500 mt-0.5">Personalised to your goals</p>
        </div>
        <Button
          onClick={getRecommendations}
          disabled={loading}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Finding books...</>
            : <><Sparkles className="h-4 w-4" /> Get Recommendations</>
          }
        </Button>
      </div>

      {books.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <BookOpen className="h-10 w-10 text-violet-400/30 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No recommendations yet.</p>
          <p className="text-slate-600 text-xs mt-1">
            Click "Get Recommendations" for books matched to your goals.
          </p>
        </div>
      )}

      {books.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {books.map((book, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3 flex flex-col"
            >
              <BookCover title={book.title} index={i} />

              <div className="space-y-1.5 flex-1">
                <span className={cn('text-xs px-2 py-0.5 rounded-full', genreStyle(book.genre))}>
                  {book.genre}
                </span>
                <p className="text-sm font-semibold text-white leading-snug">{book.title}</p>
                <p className="text-xs text-slate-500">{book.author}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{book.reason}</p>
                <p className="text-xs text-violet-300 italic leading-relaxed">
                  💡 {book.key_lesson}
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => saveBook(book, i)}
                disabled={saved.has(i) || saving === i}
                className={cn(
                  'w-full text-xs',
                  saved.has(i)
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                )}
              >
                {saving === i
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : saved.has(i)
                    ? <><Check className="h-3 w-3 mr-1" /> Saved</>
                    : '+ Save to List'
                }
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
