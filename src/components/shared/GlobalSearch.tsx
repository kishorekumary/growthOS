'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, BookOpen, CheckSquare, Target, Brain,
  NotebookPen, Dumbbell, Utensils, Wallet, Flame, Loader2, Compass,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchResultItem } from '@/app/api/search/route'

const TYPE_CONFIG: Record<
  SearchResultItem['type'],
  { label: string; Icon: React.ElementType; color: string }
> = {
  section:   { label: 'Go to',      Icon: Compass,     color: 'text-indigo-400' },
  task:      { label: 'Tasks',      Icon: CheckSquare, color: 'text-blue-400'   },
  book:      { label: 'Books',      Icon: BookOpen,    color: 'text-amber-400'  },
  goal:      { label: 'Goals',      Icon: Target,      color: 'text-green-400'  },
  habit:     { label: 'Habits',     Icon: Brain,       color: 'text-purple-400' },
  journal:   { label: 'Journal',    Icon: NotebookPen, color: 'text-rose-400'   },
  workout:   { label: 'Fitness',    Icon: Dumbbell,    color: 'text-orange-400' },
  nutrition: { label: 'Nutrition',  Icon: Utensils,    color: 'text-lime-400'   },
  finance:   { label: 'Finance',    Icon: Wallet,      color: 'text-emerald-400'},
  challenge: { label: 'Challenges', Icon: Flame,       color: 'text-red-400'    },
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive]   = useState(0)

  const inputRef    = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Open via keyboard shortcut or custom event
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    function onEvent() { setOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('global-search-open', onEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('global-search-open', onEvent)
    }
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setActive(0)
    }
  }, [open])

  function close() {
    setOpen(false)
    setQuery('')
    setResults([])
  }

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim() || q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.results ?? [])
        setActive(0)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    search(e.target.value)
  }

  function navigate(item: SearchResultItem) {
    router.push(item.href)
    close()
  }

  // Keyboard navigation inside results
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { close(); return }
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) navigate(results[active])
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // Group results by type, preserving insertion order of types
  const groups: { type: SearchResultItem['type']; items: SearchResultItem[] }[] = []
  const seen = new Set<string>()
  results.forEach(r => {
    if (!seen.has(r.type)) {
      seen.add(r.type)
      groups.push({ type: r.type, items: [] })
    }
    groups.find(g => g.type === r.type)!.items.push(r)
  })

  // Flat index for keyboard nav
  const flatItems = groups.flatMap(g => g.items)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#0d0d1a] shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          {loading
            ? <Loader2 className="h-4 w-4 text-slate-500 shrink-0 animate-spin" />
            : <Search className="h-4 w-4 text-slate-500 shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, books, workouts, goals…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
                className="text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono">
              esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-600">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {!query && (
            <div className="py-10 text-center text-sm text-slate-700">
              Type at least 2 characters to search
            </div>
          )}

          {groups.map((group) => {
            const cfg = TYPE_CONFIG[group.type]
            const GroupIcon = cfg.Icon
            return (
              <div key={group.type}>
                {/* Section header */}
                <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                  <GroupIcon className={cn('h-3 w-3 shrink-0', cfg.color)} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    {cfg.label}
                  </span>
                </div>

                {group.items.map((item) => {
                  const idx = flatItems.indexOf(item)
                  const isActive = idx === active
                  return (
                    <button
                      key={item.id}
                      data-idx={idx}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setActive(idx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isActive ? 'bg-indigo-500/[0.12]' : 'hover:bg-white/[0.03]',
                        item.type === 'section' && 'py-2',
                      )}
                    >
                      <GroupIcon className={cn('h-4 w-4 shrink-0', cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isActive ? 'text-white' : 'text-slate-300',
                        )}>
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-slate-600 truncate">{item.subtitle}</p>
                        )}
                      </div>
                      {item.type === 'section' ? (
                        <span className="text-[10px] text-indigo-500/70 shrink-0 ml-2 font-mono">↵ go</span>
                      ) : item.meta ? (
                        <span className="text-xs text-slate-600 shrink-0 ml-2">{item.meta}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {results.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between">
              <span className="text-[10px] text-slate-700">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-slate-700">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono">↵</kbd>
                  open
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
