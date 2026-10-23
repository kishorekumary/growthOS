'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Pin, PinOff, Plus, Search, StickyNote, Trash2, Check, Loader2 } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import EmptyState from '@/components/ui/empty-state'
import RichTextEditor from '@/components/shared/RichTextEditor'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'
import { checklistProgress, isBlankNote, notePreview, sortNotes } from '@/lib/notes'
import { cn } from '@/lib/utils'

export interface Note {
  id: string
  title: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

interface Draft { id: string | null; title: string; content: string; is_pinned: boolean }

const SAVE_DELAY_MS = 700

// ─── List card ────────────────────────────────────────────────────

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const progress = checklistProgress(note.content)
  const preview  = notePreview(note.content)
  return (
    <button type="button" onClick={onOpen}
      className={cn('w-full rounded-xl border px-4 py-3 text-left transition-all hover:border-white/20 active:scale-[0.99]',
        note.is_pinned ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-white/10 bg-white/[0.03]')}>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold text-white">{note.title.trim() || preview.split(' ').slice(0, 6).join(' ') || 'Untitled'}</p>
        {note.is_pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
      </div>
      {note.title.trim() && preview && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{preview}</p>}
      {progress ? (
        <div className="mt-2">
          <p className="text-[11px] text-slate-500">{progress.done} of {progress.total} done</p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-600">Edited {formatDistanceToNow(parseISO(note.updated_at), { addSuffix: true })}</p>
      )}
    </button>
  )
}

// ─── Editor ───────────────────────────────────────────────────────

function NoteEditor({ initial, onSaved, onDeleted, onClose }: {
  initial:   Draft
  onSaved:   (note: Note) => void
  onDeleted: (id: string) => void
  onClose:   () => void
}) {
  const [draft, setDraft]   = useState<Draft>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const dirty    = useRef(false)
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Saves run one after another, so a new note is inserted exactly once.
  const queue    = useRef<Promise<void>>(Promise.resolve())

  function save(): Promise<void> {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (!dirty.current) return queue.current
    dirty.current = false
    queue.current = queue.current.then(async () => {
      const d = draftRef.current
      if (!d.id && isBlankNote(d.title, d.content)) return
      setStatus('saving')
      const supabase = createSupabaseBrowserClient()
      const fields = { title: d.title.trim(), content: d.content, is_pinned: d.is_pinned, updated_at: new Date().toISOString() }
      let res
      if (d.id) {
        res = await supabase.from('notes').update(fields).eq('id', d.id).select().single()
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setStatus('error'); return }
        res = await supabase.from('notes').insert({ ...fields, user_id: session.user.id }).select().single()
      }
      if (res.error || !res.data) { setStatus('error'); dirty.current = true; return }
      const saved = res.data as Note
      if (!draftRef.current.id) setDraft(prev => ({ ...prev, id: saved.id }))
      draftRef.current = { ...draftRef.current, id: saved.id }
      onSaved(saved)
      setStatus('saved')
    })
    return queue.current
  }

  function change(patch: Partial<Draft>, immediate = false) {
    dirty.current = true
    setDraft(prev => ({ ...prev, ...patch }))
    draftRef.current = { ...draftRef.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    if (immediate) save()
    else timer.current = setTimeout(save, SAVE_DELAY_MS)
  }

  // Leaving the page mid-edit still saves.
  useEffect(() => () => { save() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBack() {
    await save()
    const d = draftRef.current
    // A note emptied out entirely isn't worth keeping.
    if (d.id && isBlankNote(d.title, d.content)) {
      await createSupabaseBrowserClient().from('notes').delete().eq('id', d.id)
      onDeleted(d.id)
    }
    onClose()
  }

  async function handleDelete() {
    if (timer.current) clearTimeout(timer.current)
    dirty.current = false
    await queue.current
    const id = draftRef.current.id
    if (id) {
      await createSupabaseBrowserClient().from('notes').delete().eq('id', id)
      onDeleted(id)
    }
    onClose()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={handleBack}
          className="flex items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-slate-400 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Notes
        </button>
        <div className="flex items-center gap-1">
          <span className="mr-1 flex items-center gap-1 text-[11px] text-slate-500">
            {status === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving</>}
            {status === 'saved'  && <><Check className="h-3 w-3 text-emerald-400" /> Saved</>}
            {status === 'error'  && <span className="text-rose-400">Not saved, check your connection</span>}
          </span>
          <button type="button" onClick={() => change({ is_pinned: !draft.is_pinned }, true)}
            title={draft.is_pinned ? 'Unpin' : 'Pin to top'} aria-label={draft.is_pinned ? 'Unpin' : 'Pin to top'}
            className={cn('rounded-lg p-2 transition-colors',
              draft.is_pinned ? 'bg-amber-500/15 text-amber-300' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
            {draft.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} title="Delete note" aria-label="Delete note"
            className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          Delete this note?
          <span className="flex gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-slate-300 hover:text-white">Cancel</button>
            <button type="button" onClick={handleDelete} className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700">Delete</button>
          </span>
        </div>
      )}

      <input
        value={draft.title}
        onChange={e => change({ title: e.target.value })}
        placeholder="Title"
        className="w-full bg-transparent text-lg font-bold text-white placeholder:text-slate-600 focus:outline-none"
      />
      <RichTextEditor
        value={draft.content}
        onChange={html => change({ content: html })}
        placeholder="Write anything, or tap Checklist for a list…"
        checklist
        autoFocus={!initial.id}
        className="min-h-[50vh]"
      />
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────

export default function NotesApp() {
  const router = useRouter()
  const params = useSearchParams()
  const { data: notes, loading, setData: setNotes } = useCachedQuery<Note[]>(
    'notes:all',
    (supabase, userId) => supabase
      .from('notes')
      .select('id,title,content,is_pinned,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    [],
    []
  )
  const [open, setOpen]   = useState<Draft | null>(null)
  const [query, setQuery] = useState('')

  // /notes?new=1 starts a note; /notes?id=… opens one (from Quick Log).
  const wantId  = params.get('id')
  const wantNew = params.get('new') === '1'
  useEffect(() => {
    if (wantNew) setOpen({ id: null, title: '', content: '', is_pinned: false })
  }, [wantNew])
  useEffect(() => {
    if (!wantId) return
    const n = notes.find(n => n.id === wantId)
    if (n) setOpen({ id: n.id, title: n.title, content: n.content, is_pinned: n.is_pinned })
  }, [wantId, notes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    setOpen(null)
    if (wantId || wantNew) router.replace('/notes')
  }

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hits = q ? notes.filter(n => n.title.toLowerCase().includes(q) || notePreview(n.content, 10_000).toLowerCase().includes(q)) : notes
    return sortNotes(hits)
  }, [notes, query])
  const pinned = sorted.filter(n => n.is_pinned)
  const others = sorted.filter(n => !n.is_pinned)

  if (open) return (
    <NoteEditor
      key={open.id ?? 'new'}
      initial={open}
      onSaved={saved => setNotes(prev => [saved, ...prev.filter(n => n.id !== saved.id)])}
      onDeleted={id => setNotes(prev => prev.filter(n => n.id !== id))}
      onClose={close}
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none" />
        </div>
        <button type="button" onClick={() => setOpen({ id: null, title: '', content: '', is_pinned: false })}
          className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 active:scale-95 transition-all">
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      {!loading && notes.length === 0 ? (
        <EmptyState icon={StickyNote} tone="amber" title="No notes yet"
          hint="Jot down a shopping list, an idea or a code you need to remember. Pin the important ones to keep them on top." />
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="space-y-2">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300/80"><Pin className="h-3 w-3" /> Pinned</p>
              {pinned.map(n => <NoteCard key={n.id} note={n} onOpen={() => setOpen(n)} />)}
            </section>
          )}
          {others.length > 0 && (
            <section className="space-y-2">
              {pinned.length > 0 && <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Others</p>}
              {others.map(n => <NoteCard key={n.id} note={n} onOpen={() => setOpen(n)} />)}
            </section>
          )}
          {query && sorted.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No notes match “{query}”.</p>}
        </>
      )}
    </div>
  )
}
