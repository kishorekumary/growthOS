'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload, X, Trash2, ZoomIn, ChevronLeft, ChevronRight,
  Loader2, ImageIcon, Pencil, Check, Plus, Tag,
  FileText, ExternalLink, FolderOpen,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface GalleryItem {
  id: string
  storage_path: string
  url: string
  caption: string | null
  tags: string[] | null
  mime_type: string | null
  created_at: string
}

// Accepted MIME types — images and PDF documents
function isAccepted(type: string) {
  return type.startsWith('image/') || type === 'application/pdf'
}

function fileKind(item: GalleryItem): 'image' | 'pdf' {
  if (item.mime_type) {
    if (item.mime_type === 'application/pdf') return 'pdf'
    if (item.mime_type.startsWith('image/')) return 'image'
  }
  // Fallback for existing items without mime_type: check extension
  if (item.storage_path.toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'image'
}

export default function Gallery({ initialItems, userId }: { initialItems: GalleryItem[]; userId: string }) {
  const [items, setItems]           = useState<GalleryItem[]>(initialItems)
  const [uploading, setUploading]   = useState(false)
  const [uploadNames, setUploadNames] = useState<string[]>([])
  const [lightbox, setLightbox]     = useState<number | null>(null)
  const [filterTag, setFilterTag]   = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [dragging, setDragging]     = useState(false)

  const [editCaptionId, setEditCaptionId] = useState<string | null>(null)
  const [captionDraft, setCaptionDraft]   = useState('')
  const [addTagId, setAddTagId]           = useState<string | null>(null)
  const [tagDraft, setTagDraft]           = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const filteredRef = useRef<GalleryItem[]>([])

  const filtered = filterTag ? items.filter(i => i.tags?.includes(filterTag)) : items
  filteredRef.current = filtered

  const allTags = Array.from(new Set(items.flatMap(i => i.tags ?? []))).sort()

  // Paste from clipboard — images only (PDFs can't be pasted)
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const imageItems = Array.from(e.clipboardData?.items ?? []).filter(it => it.type.startsWith('image/'))
      const files = imageItems.map(it => it.getAsFile()).filter(Boolean) as File[]
      if (files.length) uploadFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard nav for lightbox
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightbox === null) return
      const len = filteredRef.current.length
      if (e.key === 'Escape')     setLightbox(null)
      if (e.key === 'ArrowLeft')  setLightbox(i => i === null ? null : (i - 1 + len) % len)
      if (e.key === 'ArrowRight') setLightbox(i => i === null ? null : (i + 1) % len)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  // Reset lightbox when filter changes
  useEffect(() => { setLightbox(null) }, [filterTag])

  const uploadFiles = useCallback(async (files: File[]) => {
    const valid = files.filter(f => isAccepted(f.type))
    if (!valid.length) return
    setUploading(true)
    setError(null)
    setUploadNames(valid.map(f => f.name || 'file'))
    const supabase = createSupabaseBrowserClient()
    const newItems: GalleryItem[] = []

    for (const file of valid) {
      const ext  = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: upErr } = await supabase.storage.from('gallery').upload(path, file)
      if (upErr) { setError(`Upload failed: ${upErr.message}`); continue }

      const { data: { publicUrl } } = supabase.storage.from('gallery').getPublicUrl(path)

      // For non-image files pre-fill caption with the original filename
      const autoCaption = !file.type.startsWith('image/') ? file.name : null

      const { data: row, error: dbErr } = await supabase
        .from('user_gallery')
        .insert({
          user_id: userId,
          storage_path: path,
          url: publicUrl,
          caption: autoCaption,
          tags: [],
          mime_type: file.type || null,
        })
        .select()
        .single()
      if (!dbErr && row) newItems.push(row as GalleryItem)
    }

    setItems(prev => [...newItems.reverse(), ...prev])
    setUploading(false)
    setUploadNames([])
  }, [userId])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) uploadFiles(files)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  async function deleteItem(item: GalleryItem) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    setLightbox(null)
    const supabase = createSupabaseBrowserClient()
    await supabase.storage.from('gallery').remove([item.storage_path])
    await supabase.from('user_gallery').delete().eq('id', item.id)
  }

  async function saveCaption(id: string) {
    const val = captionDraft.trim() || null
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_gallery').update({ caption: val }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, caption: val } : i))
    setEditCaptionId(null)
  }

  async function addTag(id: string) {
    const tag = tagDraft.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag) return
    const item = items.find(i => i.id === id)
    if (!item) return
    const newTags = Array.from(new Set([...(item.tags ?? []), tag]))
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_gallery').update({ tags: newTags }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, tags: newTags } : i))
    setTagDraft(''); setAddTagId(null)
  }

  async function removeTag(id: string, tag: string) {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newTags = (item.tags ?? []).filter(t => t !== tag)
    const supabase = createSupabaseBrowserClient()
    await supabase.from('user_gallery').update({ tags: newTags }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, tags: newTags } : i))
  }

  const lightboxItem = lightbox !== null ? filtered[lightbox] : null

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Gallery</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {items.length} file{items.length !== 1 ? 's' : ''} · drag-drop, click, or ⌘V to paste a screenshot
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* ── Drop zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none',
          dragging
            ? 'border-violet-400/60 bg-violet-500/10 py-10'
            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02] py-6',
        )}
      >
        <FolderOpen className={cn('h-7 w-7', dragging ? 'text-violet-400' : 'text-slate-600')} />
        <p className="text-sm text-slate-500 text-center px-4">
          {dragging
            ? 'Drop files here'
            : 'Drag & drop images or PDFs · click to browse · paste a screenshot with ⌘V / Ctrl+V'}
        </p>
      </div>

      {/* ── Upload progress ── */}
      {uploading && uploadNames.length > 0 && (
        <div className="space-y-1">
          {uploadNames.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin text-violet-400 shrink-0" />
              Uploading {name}…
            </div>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <p className="flex-1 leading-snug">{error}</p>
          <button onClick={() => setError(null)} className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Tag filter pills ── */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterTag(null)}
            className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-all',
              !filterTag
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-white')}
          >
            All ({items.length})
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(f => f === tag ? null : tag)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-all',
                filterTag === tag
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-white')}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <FolderOpen className="h-12 w-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {filterTag ? `No files tagged #${filterTag}` : 'No files yet — upload images or PDFs to get started'}
          </p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
          {filtered.map((item, idx) => {
            const kind = fileKind(item)
            return (
              <div
                key={item.id}
                className="group relative mb-3 break-inside-avoid rounded-xl overflow-hidden border border-white/10 bg-white/5"
              >
                <button
                  onClick={() => setLightbox(idx)}
                  className="block w-full focus:outline-none"
                >
                  {kind === 'pdf' ? (
                    /* PDF card thumbnail */
                    <div className="flex flex-col items-center justify-center gap-2 py-8 px-3 min-h-[100px]">
                      <FileText className="h-10 w-10 text-red-400 shrink-0" />
                      <p className="text-xs text-slate-400 text-center leading-snug line-clamp-2 break-all">
                        {item.caption ?? 'PDF Document'}
                      </p>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.url}
                      alt={item.caption ?? ''}
                      className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  )}
                </button>

                {/* Hover tint */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all pointer-events-none rounded-xl" />

                {/* Top-right actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setLightbox(idx)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors"
                    title={kind === 'pdf' ? 'Preview' : 'View full size'}
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteItem(item)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600/70 backdrop-blur-sm text-white hover:bg-red-600/90 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Caption / tags footer */}
                {(kind === 'image' && (item.caption || (item.tags ?? []).length > 0)) && (
                  <div className="px-2.5 py-2 space-y-1">
                    {item.caption && (
                      <p className="text-xs text-slate-300 leading-snug line-clamp-2">{item.caption}</p>
                    )}
                    {(item.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags!.map(tag => (
                          <span key={tag} className="text-[10px] rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-400 px-1.5 py-0.5">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* For PDFs always show tags if any */}
                {kind === 'pdf' && (item.tags ?? []).length > 0 && (
                  <div className="px-2.5 pb-2 flex flex-wrap gap-1">
                    {item.tags!.map(tag => (
                      <span key={tag} className="text-[10px] rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-400 px-1.5 py-0.5">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/92 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setLightbox(null) }}
        >
          {/* Prev */}
          {filtered.length > 1 && (
            <button
              onClick={() => setLightbox(i => i === null ? null : (i - 1 + filtered.length) % filtered.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Content */}
          <div className="flex flex-col items-center gap-4 w-full max-w-4xl px-14 max-h-[95vh]">
            {fileKind(lightboxItem) === 'pdf' ? (
              /* PDF viewer */
              <div className="w-full flex flex-col gap-3">
                <iframe
                  src={lightboxItem.url}
                  title={lightboxItem.caption ?? 'PDF'}
                  className="w-full rounded-xl border border-white/10 bg-white"
                  style={{ height: '65vh' }}
                />
                <a
                  href={lightboxItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 self-center text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in new tab
                </a>
              </div>
            ) : (
              /* Image viewer */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={lightboxItem.url}
                alt={lightboxItem.caption ?? ''}
                className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
              />
            )}

            {/* Metadata panel */}
            <div className="w-full max-w-xl space-y-3 px-2">
              {/* Caption */}
              {editCaptionId === lightboxItem.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={captionDraft}
                    onChange={e => setCaptionDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCaption(lightboxItem.id)
                      if (e.key === 'Escape') setEditCaptionId(null)
                    }}
                    placeholder="Add a caption…"
                    className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                  />
                  <button onClick={() => saveCaption(lightboxItem.id)} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditCaptionId(null)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditCaptionId(lightboxItem.id); setCaptionDraft(lightboxItem.caption ?? '') }}
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors group w-full text-left"
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {lightboxItem.caption
                    ? <span>{lightboxItem.caption}</span>
                    : <span className="text-slate-600 italic">Add a caption…</span>}
                </button>
              )}

              {/* Tags */}
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                {(lightboxItem.tags ?? []).map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[11px] rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 px-2 py-0.5">
                    #{tag}
                    <button
                      onClick={() => removeTag(lightboxItem.id, tag)}
                      className="hover:text-red-400 transition-colors ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {addTagId === lightboxItem.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={tagDraft}
                      onChange={e => setTagDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addTag(lightboxItem.id)
                        if (e.key === 'Escape') setAddTagId(null)
                      }}
                      placeholder="tag"
                      className="w-24 rounded-full border border-violet-500/30 bg-white/5 px-2.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-violet-400"
                    />
                    <button onClick={() => addTag(lightboxItem.id)} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setAddTagId(null)} className="text-slate-600 hover:text-white transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddTagId(lightboxItem.id); setTagDraft('') }}
                    className="flex items-center gap-1 text-[11px] rounded-full border border-dashed border-white/20 text-slate-500 hover:text-white hover:border-white/40 px-2.5 py-0.5 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> add tag
                  </button>
                )}
              </div>

              {/* Footer row */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-600">
                  {format(new Date(lightboxItem.created_at), 'MMM d, yyyy · h:mm a')}
                  {filtered.length > 1 && (
                    <span className="ml-2 tabular-nums">{(lightbox ?? 0) + 1} / {filtered.length}</span>
                  )}
                </p>
                <button
                  onClick={() => deleteItem(lightboxItem)}
                  className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>

          {/* Next */}
          {filtered.length > 1 && (
            <button
              onClick={() => setLightbox(i => i === null ? null : (i + 1) % filtered.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Close */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}
