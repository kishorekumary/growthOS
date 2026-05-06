'use client'

import { useState, useRef } from 'react'
import { X, Trash2, GitBranch, Loader2, Check, Pencil, Upload } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NODE_W = 160
const NODE_H = 40
const DEPTH_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

export interface MindNode {
  id: string
  label: string
  parentId: string | null
  x: number
  y: number
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function bezier(p: MindNode, c: MindNode): string {
  const x1 = p.x + NODE_W
  const y1 = p.y + NODE_H / 2
  const x2 = c.x
  const y2 = c.y + NODE_H / 2
  const cx = Math.max(40, (x2 - x1) / 2)
  return `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`
}

function getDepth(id: string, nodes: MindNode[]): number {
  let d = 0
  let cur = nodes.find(n => n.id === id)
  while (cur?.parentId) {
    cur = nodes.find(n => n.id === cur!.parentId)
    d++
    if (d > 20) break
  }
  return d
}

// ─── Import helpers ──────────────────────────────────────────

interface TreeNode { label: string; children: TreeNode[] }

function parseImportText(text: string): TreeNode | null {
  const lines = text.split('\n').filter(l => l.trim())
  if (!lines.length) return null

  const isMarkdown = lines.some(l => /^#{1,6}\s/.test(l))

  function getIndent(line: string) {
    return (line.match(/^(\s*)/)?.[1].length ?? 0)
  }
  function stripMarkers(line: string) {
    return line.trim().replace(/^#{1,6}\s+/, '').replace(/^[-*•]\s+/, '')
  }
  function getDepth(line: string) {
    if (isMarkdown) {
      const m = line.match(/^(#{1,6})\s/)
      return m ? m[1].length - 1 : 0
    }
    return Math.floor(getIndent(line) / 2)
  }

  const root: TreeNode = { label: '', children: [] }
  const stack: { node: TreeNode; depth: number }[] = [{ node: root, depth: -1 }]

  for (const line of lines) {
    if (!line.trim()) continue
    const depth = getDepth(line)
    const label = stripMarkers(line)
    if (!label) continue
    const node: TreeNode = { label, children: [] }
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop()
    stack[stack.length - 1].node.children.push(node)
    stack.push({ node, depth })
  }

  if (root.children.length === 1) return root.children[0]
  if (root.children.length > 1) {
    return { label: root.children[0].label, children: root.children.slice(1) }
  }
  return null
}

function treeToNodes(tree: TreeNode, rootId: string, originX: number): MindNode[] {
  const H_GAP = 220
  const V_GAP = 56
  const result: MindNode[] = []
  let leafCounter = 0

  function place(node: TreeNode, parentId: string | null, depth: number): number {
    const id = parentId === null ? rootId : uid()
    if (node.children.length === 0) {
      result.push({ id, label: node.label, parentId, x: depth * H_GAP + originX, y: leafCounter * V_GAP + 40 })
      return leafCounter++
    }
    const childAvgs: number[] = []
    const thisId = id
    for (const child of node.children) childAvgs.push(place(child, thisId, depth + 1))
    const avg = (childAvgs[0] + childAvgs[childAvgs.length - 1]) / 2
    result.push({ id, label: node.label, parentId, x: depth * H_GAP + originX, y: avg * V_GAP + 40 })
    return avg
  }

  place(tree, null, 0)
  return result
}

// ─── Props ────────────────────────────────────────────────────

interface Props {
  bookId: string
  bookTitle: string
  initialJson: string | null
  onClose: () => void
}

export default function BookMindMap({ bookId, bookTitle, initialJson, onClose }: Props) {
  const initNodes = (): MindNode[] => {
    if (initialJson) {
      try {
        const p = JSON.parse(initialJson)
        if (Array.isArray(p) && p.length) return p
      } catch {}
    }
    return [{ id: 'root', label: bookTitle, parentId: null, x: 60, y: 380 }]
  }

  const [nodes, setNodes] = useState<MindNode[]>(initNodes)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  function handleImport() {
    const tree = parseImportText(importText)
    if (!tree) { setImportError('Could not parse the text. Paste an indented outline or Markdown headings.'); return }
    const root = nodesRef.current.find(n => n.id === 'root')
    const newNodes = treeToNodes(tree, 'root', root?.x ?? 60)
    // keep root label as book title
    const rootNode = newNodes.find(n => n.id === 'root')
    if (rootNode) rootNode.label = bookTitle
    setNodes(newNodes)
    setImportText('')
    setImportError(null)
    setShowImport(false)
  }

  // Using refs for drag state to avoid stale closures during fast mouse moves
  const moveRef = useRef<{
    id: string; ox: number; oy: number; mx: number; my: number
  } | null>(null)
  const connRef = useRef<{ fromId: string } | null>(null)
  const [connPos, setConnPos] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  function canvasXY(e: React.MouseEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (moveRef.current) {
      const { id, ox, oy, mx, my } = moveRef.current
      const dx = e.clientX - mx
      const dy = e.clientY - my
      setNodes(prev =>
        prev.map(n => n.id === id ? { ...n, x: Math.max(4, ox + dx), y: Math.max(4, oy + dy) } : n)
      )
    }
    if (connRef.current) {
      setConnPos(canvasXY(e))
    }
  }

  function onMouseUp(e: React.MouseEvent) {
    if (connRef.current) {
      const { fromId } = connRef.current
      const { x, y } = canvasXY(e)
      const from = nodesRef.current.find(n => n.id === fromId)
      if (from) {
        const dist = Math.hypot(x - (from.x + NODE_W), y - (from.y + NODE_H / 2))
        if (dist > 24) {
          const newId = uid()
          const newNode: MindNode = {
            id: newId,
            label: 'New point',
            parentId: fromId,
            x: Math.max(8, x - NODE_W / 2),
            y: Math.max(8, y - NODE_H / 2),
          }
          setNodes(prev => [...prev, newNode])
          // slight delay so the node renders before we focus its input
          setTimeout(() => { setEditingId(newId); setEditLabel('New point') }, 20)
        }
      }
      connRef.current = null
      setConnPos(null)
    }
    moveRef.current = null
  }

  function startMove(e: React.MouseEvent, node: MindNode) {
    if (node.id === 'root') return
    moveRef.current = { id: node.id, ox: node.x, oy: node.y, mx: e.clientX, my: e.clientY }
    e.stopPropagation()
    e.preventDefault()
  }

  function startConn(e: React.MouseEvent, fromId: string) {
    connRef.current = { fromId }
    setConnPos(canvasXY(e))
    e.stopPropagation()
    e.preventDefault()
  }

  function commitEdit(id: string) {
    const label = editLabel.trim()
    if (label) {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, label } : n))
    } else {
      deleteNode(id)
    }
    setEditingId(null)
  }

  function deleteNode(id: string) {
    if (id === 'root') return
    const toDelete = new Set<string>()
    const collect = (nid: string) => {
      toDelete.add(nid)
      nodesRef.current.filter(n => n.parentId === nid).forEach(c => collect(c.id))
    }
    collect(id)
    setNodes(prev => prev.filter(n => !toDelete.has(n.id)))
    if (editingId && toDelete.has(editingId)) setEditingId(null)
  }

  async function save() {
    setSaving(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase
      .from('reading_log')
      .update({ key_lessons: JSON.stringify(nodesRef.current), updated_at: new Date().toISOString() })
      .eq('id', bookId)
    setSaving(false)
    if (error) {
      // key_lessons column missing — surface the required migration to the user
      setSaveError('Run in Supabase SQL editor: ALTER TABLE reading_log ADD COLUMN IF NOT EXISTS key_lessons TEXT;')
      return
    }
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const CANVAS_W = 2400
  const CANVAS_H = 1600

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#090912' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-black/40 backdrop-blur shrink-0">
        <GitBranch className="h-4 w-4 text-violet-400 shrink-0" />
        <p className="text-sm font-semibold text-white truncate flex-1">{bookTitle}</p>
        <span className="hidden sm:block text-xs text-slate-500 shrink-0">Mind Map</span>
        <button
          onClick={() => { setShowImport(true); setImportError(null) }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all shrink-0"
        >
          <Upload className="h-3 w-3" />
          Import
        </button>
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0',
            savedFlash
              ? 'bg-emerald-600 text-white'
              : 'bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50'
          )}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : savedFlash ? (
            <Check className="h-3 w-3" />
          ) : null}
          {savedFlash ? 'Saved!' : 'Save'}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Hint / error bar ── */}
      {saveError ? (
        <div className="px-4 py-2 border-b border-red-500/20 bg-red-500/10 shrink-0 flex items-start gap-2">
          <p className="text-[11px] text-red-400 flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-300 shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="px-4 py-1.5 border-b border-white/5 bg-white/[0.015] shrink-0">
          <p className="text-[11px] text-slate-600">
            Drag the <span className="text-violet-500">●</span> handle on any node right to draw a branch &nbsp;·&nbsp;
            Click <span className="text-violet-500">✎</span> to edit label &nbsp;·&nbsp;
            Drag node body to reposition
          </p>
        </div>
      )}

      {/* ── Import overlay ── */}
      {showImport && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-slate-900 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Import from NotebookLM</p>
                <p className="text-xs text-slate-500 mt-0.5">Replaces the current mind map</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 space-y-1">
              <p className="text-[11px] font-medium text-slate-400">How to get the text from NotebookLM</p>
              <p className="text-[11px] text-slate-500">Open your mind map → click the outline/text view → select all → paste below.</p>
              <p className="text-[11px] text-slate-500">Supports: <span className="text-slate-400">indented text, Markdown headings (# ## ###), bullet lists (- *)</span></p>
            </div>

            <textarea
              autoFocus
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportError(null) }}
              placeholder={`# Book Title\n## Chapter 1\n### Key idea\n### Another idea\n## Chapter 2`}
              className="w-full h-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-700 font-mono focus:outline-none focus:border-violet-500/50 resize-none"
            />

            {importError && (
              <p className="text-xs text-red-400">{importError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowImport(false)}
                className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-slate-400 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 py-2 text-xs font-medium text-white transition-colors"
              >
                Import & Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scrollable canvas ── */}
      <div className="flex-1 overflow-auto">
        <div
          ref={canvasRef}
          className="relative select-none"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >

          {/* ── SVG edges ── */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ overflow: 'visible' }}
          >
            {nodes
              .filter(n => n.parentId)
              .map(child => {
                const parent = nodesRef.current.find(p => p.id === child.parentId)
                if (!parent) return null
                const d = getDepth(child.id, nodesRef.current)
                const color = DEPTH_COLORS[d % DEPTH_COLORS.length]
                return (
                  <path
                    key={`edge-${child.id}`}
                    d={bezier(parent, child)}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                  />
                )
              })}

            {/* Live drag line while connecting */}
            {connRef.current && connPos && (() => {
              const from = nodesRef.current.find(n => n.id === connRef.current!.fromId)
              if (!from) return null
              const fakeChild: MindNode = {
                id: '__tmp__',
                label: '',
                parentId: null,
                x: connPos.x - NODE_W / 2,
                y: connPos.y - NODE_H / 2,
              }
              return (
                <path
                  d={bezier(from, fakeChild)}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeDasharray="7 5"
                  strokeOpacity={0.7}
                />
              )
            })()}
          </svg>

          {/* ── Nodes ── */}
          {nodes.map(node => {
            const isRoot = node.id === 'root'
            const isEditing = editingId === node.id
            const d = getDepth(node.id, nodes)
            const color = DEPTH_COLORS[d % DEPTH_COLORS.length]

            return (
              <div
                key={node.id}
                className={cn(
                  'absolute group flex items-center gap-1 rounded-lg border px-2.5',
                  'transition-shadow duration-150',
                  'hover:shadow-[0_0_16px_rgba(124,58,237,0.35)]',
                  isRoot ? 'cursor-default' : 'cursor-move',
                )}
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_W,
                  height: NODE_H,
                  borderColor: isRoot ? 'rgba(124,58,237,0.55)' : color + '44',
                  background: isRoot
                    ? 'rgba(109,40,217,0.25)'
                    : 'rgba(12,12,26,0.88)',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseDown={isRoot ? undefined : e => startMove(e, node)}
              >
                {/* Label / inline input */}
                {isEditing ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit(node.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => commitEdit(node.id)}
                    onMouseDown={e => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent text-xs font-medium focus:outline-none"
                    style={{ color: isRoot ? '#c4b5fd' : color }}
                  />
                ) : (
                  <span
                    className="flex-1 min-w-0 text-xs font-medium leading-snug truncate"
                    style={{ color: isRoot ? '#c4b5fd' : color }}
                  >
                    {node.label}
                  </span>
                )}

                {/* Edit icon */}
                {!isRoot && !isEditing && (
                  <button
                    type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      setEditingId(node.id)
                      setEditLabel(node.label)
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 transition-all"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                )}

                {/* Delete icon */}
                {!isRoot && !isEditing && (
                  <button
                    type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}

                {/* ── Connect handle (right edge) ── */}
                <div
                  className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity"
                  onMouseDown={e => startConn(e, node.id)}
                >
                  <div
                    className={cn(
                      'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                      'border-violet-500/60 bg-violet-600/20',
                      'hover:bg-violet-500 hover:border-violet-400 transition-colors'
                    )}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
