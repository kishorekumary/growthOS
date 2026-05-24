'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'
import { Bold, Italic, Underline as UnderlineIcon, Highlighter } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const TB = 'h-7 w-7 flex items-center justify-center rounded text-xs font-bold transition-colors'
const ON = 'bg-white/20 text-white'
const OFF = 'text-slate-400 hover:bg-white/10 hover:text-white'

export default function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Highlight,
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
    ],
    content: toHtml(value),
    editorProps: {
      attributes: { class: 'rich-editor outline-none min-h-[5rem] py-1' },
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

  const btn = (active: boolean) => cn(TB, active ? ON : OFF)

  return (
    <div className={cn('rounded-lg border border-white/10 bg-white/5 overflow-hidden', className)}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/8 bg-white/3 flex-wrap">
        <button type="button" title="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btn(editor.isActive('heading', { level: 1 }))}>H1</button>
        <button type="button" title="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive('heading', { level: 2 }))}>H2</button>
        <button type="button" title="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btn(editor.isActive('heading', { level: 3 }))}>H3</button>

        <span className="w-px h-4 bg-white/10 mx-1 shrink-0" />

        <button type="button" title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive('bold'))}>
          <Bold className="h-3.5 w-3.5" /></button>
        <button type="button" title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive('italic'))}>
          <Italic className="h-3.5 w-3.5" /></button>
        <button type="button" title="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btn(editor.isActive('underline'))}>
          <UnderlineIcon className="h-3.5 w-3.5" /></button>
        <button type="button" title="Highlight"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={btn(editor.isActive('highlight'))}>
          <Highlighter className="h-3.5 w-3.5" /></button>
      </div>

      <EditorContent editor={editor} className="px-3 py-2.5 text-sm text-white" />
    </div>
  )
}
