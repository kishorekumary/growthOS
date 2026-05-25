'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension, type Editor } from '@tiptap/core'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Bold, Italic, Underline as UnderlineIcon, Highlighter } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Inline font-size mark (applies only to selected text) ─────────
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, string | null>) =>
            attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {},
        },
      },
    }]
  },
})

// ── Bubble toolbar — floats above the current text selection ──────
const SIZES = [
  { label: 'H1', size: '1.5em',  title: 'Large heading' },
  { label: 'H2', size: '1.2em',  title: 'Medium heading' },
  { label: 'H3', size: '1.05em', title: 'Small heading'  },
] as const

function BubbleToolbar({ editor }: { editor: Editor }) {
  const [rect, setRect]   = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const update = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    const { state, view } = editor
    if (state.selection.empty) { setRect(null); return }
    const { from, to } = state.selection
    const startCoords = view.coordsAtPos(from)
    const endCoords   = view.coordsAtPos(to)
    const midX = (startCoords.left + endCoords.left) / 2
    const topY = Math.min(startCoords.top, endCoords.top)
    setRect({ top: topY - 52, left: midX })
  }, [editor])

  useEffect(() => {
    editor.on('selectionUpdate', update)
    editor.on('transaction',     update)
    const onBlur = () => {
      hideTimer.current = setTimeout(() => setRect(null), 150)
    }
    editor.on('blur', onBlur)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction',     update)
      editor.off('blur', onBlur)
    }
  }, [editor, update])

  if (!mounted || !rect || editor.state.selection.empty) return null

  // Clamp so the menu doesn't overflow viewport edges
  const clampedLeft = Math.max(100, Math.min(rect.left, window.innerWidth - 100))

  const btn = (active: boolean) =>
    cn('h-7 px-1.5 flex items-center justify-center rounded text-xs font-bold transition-colors',
       active ? 'bg-white/25 text-white' : 'text-slate-300 hover:bg-white/15 hover:text-white')

  function toggleSize(size: string) {
    const active = editor.isActive('textStyle', { fontSize: size })
    editor.chain().focus()
      .setMark('textStyle', { fontSize: active ? null : size })
      .run()
  }

  const menu = (
    <div
      onMouseDown={e => e.preventDefault()} // keep editor focused
      style={{ position: 'fixed', top: rect.top, left: clampedLeft, transform: 'translateX(-50%)', zIndex: 9999 }}
      className="flex items-center gap-0.5 rounded-lg bg-slate-800 border border-white/15 shadow-2xl px-1.5 py-1"
    >
      {SIZES.map(({ label, size, title }) => (
        <button key={label} type="button" title={title}
          onClick={() => toggleSize(size)}
          className={btn(editor.isActive('textStyle', { fontSize: size }))}>
          {label}
        </button>
      ))}

      <span className="w-px h-4 bg-white/15 mx-0.5 shrink-0" />

      <button type="button" title="Bold (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive('bold'))}>
        <Bold className="h-3.5 w-3.5" /></button>
      <button type="button" title="Italic (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive('italic'))}>
        <Italic className="h-3.5 w-3.5" /></button>
      <button type="button" title="Underline (Ctrl+U)"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btn(editor.isActive('underline'))}>
        <UnderlineIcon className="h-3.5 w-3.5" /></button>
      <button type="button" title="Highlight"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={btn(editor.isActive('highlight'))}>
        <Highlighter className="h-3.5 w-3.5" /></button>
    </div>
  )

  return createPortal(menu, document.body)
}

// ── Helpers ───────────────────────────────────────────────────────

function toHtml(val: string): string {
  if (!val) return ''
  return val.trimStart().startsWith('<') ? val : `<p>${val}</p>`
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export default function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Keep headings enabled so pasted HTML (h1, h2 …) renders as-is
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      FontSize,
      Highlight,
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
    ],
    content: toHtml(value),
    editorProps: {
      attributes: { class: 'rich-editor outline-none min-h-[6rem] py-1' },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  useEffect(() => {
    if (!editor || editor.isFocused) return
    const next = toHtml(value)
    if (editor.getHTML() !== next) editor.commands.setContent(next, { emitUpdate: false })
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  return (
    <div className={cn('rounded-lg border border-white/10 bg-white/5 overflow-hidden', className)}>
      {/* Floating bubble toolbar renders via portal — no static bar */}
      <BubbleToolbar editor={editor} />

      <EditorContent editor={editor} className="px-3 py-2.5 text-sm text-white" />

      {/* Subtle shortcut hint */}
      <p className="px-3 pb-2 text-[10px] text-slate-700 select-none">
        Select text to format · Ctrl+B bold · Ctrl+I italic · Ctrl+U underline
      </p>
    </div>
  )
}
