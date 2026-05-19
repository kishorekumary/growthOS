'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { X, Trash2, GitBranch, Loader2, Check, Pencil, Upload, Plus, Undo2, Link2, Eye, EyeOff, Search, ChevronLeft, ChevronRight, ChevronDown, Download, MoreHorizontal, Save, Navigation } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NODE_H = 40
const MIN_W  = 160
const MAX_W  = 320
const H_GAP  = 380
const V_GAP  = 56
const DEPTH_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

function nodeWidth(label: string): number {
  return Math.max(MIN_W, Math.min(MAX_W, label.length * 7 + 56))
}

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
  const x1 = p.x + nodeWidth(p.label)
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

// Returns true if nodeId is a descendant of ancestorId (prevents cyclic reparenting)
function isDescendant(nodeId: string, ancestorId: string, nodes: MindNode[]): boolean {
  const children = nodes.filter(n => n.parentId === ancestorId)
  for (const child of children) {
    if (child.id === nodeId) return true
    if (isDescendant(nodeId, child.id, nodes)) return true
  }
  return false
}

function nodesToMarkdown(nodes: MindNode[]): string {
  const childrenOf: Record<string, MindNode[]> = {}
  for (const n of nodes) {
    if (n.parentId !== null) {
      if (!childrenOf[n.parentId]) childrenOf[n.parentId] = []
      childrenOf[n.parentId].push(n)
    }
  }
  const lines: string[] = []
  function dfs(id: string, depth: number) {
    const node = nodes.find(n => n.id === id)
    if (!node) return
    lines.push(`${'#'.repeat(depth)} ${node.label}`)
    const kids = (childrenOf[id] ?? []).slice().sort((a, b) => a.y - b.y)
    for (const kid of kids) dfs(kid.id, depth + 1)
  }
  dfs('root', 1)
  return lines.join('\n')
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
  function getLevel(line: string) {
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
    const depth = getLevel(line)
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

// Append parsed branches attached to a specific target node
function appendBranches(text: string, existingNodes: MindNode[], targetNodeId: string): MindNode[] | null {
  const lines = text.split('\n').filter(l => l.trim())
  if (!lines.length) return null

  const isMarkdown = lines.some(l => /^#{1,6}\s/.test(l))
  function stripMarkers(line: string) {
    return line.trim().replace(/^#{1,6}\s+/, '').replace(/^[-*•]\s+/, '')
  }
  function getLevel(line: string) {
    if (isMarkdown) {
      const m = line.match(/^(#{1,6})\s/)
      return m ? m[1].length - 1 : 0
    }
    return Math.floor((line.match(/^(\s*)/)?.[1].length ?? 0) / 2)
  }

  const root: TreeNode = { label: '__root__', children: [] }
  const stack: { node: TreeNode; depth: number }[] = [{ node: root, depth: -1 }]
  for (const line of lines) {
    if (!line.trim()) continue
    const depth = getLevel(line)
    const label = stripMarkers(line)
    if (!label) continue
    const node: TreeNode = { label, children: [] }
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop()
    stack[stack.length - 1].node.children.push(node)
    stack.push({ node, depth })
  }

  const branches = root.children
  if (!branches.length) return null

  const targetNode = existingNodes.find(n => n.id === targetNodeId)
  if (!targetNode) return null

  // Determine the depth of the target node so imported branches start one level deeper
  const targetDepth = getDepth(targetNodeId, existingNodes)

  const maxY = existingNodes.reduce((m, n) => Math.max(m, n.y + NODE_H), 0)
  let leafCounter = Math.ceil((maxY + 80 - 40) / V_GAP)

  const newNodes: MindNode[] = []

  function place(node: TreeNode, parentId: string, depth: number): number {
    const id = uid()
    const xPos = targetNode!.x + (depth + 1) * H_GAP - targetDepth * H_GAP
    if (node.children.length === 0) {
      newNodes.push({ id, label: node.label, parentId, x: xPos, y: leafCounter * V_GAP + 40 })
      return leafCounter++
    }
    const avgs: number[] = []
    for (const child of node.children) avgs.push(place(child, id, depth + 1))
    const avg = (avgs[0] + avgs[avgs.length - 1]) / 2
    newNodes.push({ id, label: node.label, parentId, x: xPos, y: avg * V_GAP + 40 })
    return avg
  }

  for (const branch of branches) place(branch, targetNodeId, targetDepth)
  return newNodes
}

// ─── Inline search highlight ─────────────────────────────────

function HighlightedLabel({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="rounded-sm px-0.5" style={{ background: 'rgba(251,191,36,0.45)', color: '#fef3c7' }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}

// Returns the ancestor chain from root down to nodeId (inclusive)
function getAncestorPath(nodeId: string, nodes: MindNode[]): MindNode[] {
  const path: MindNode[] = []
  let cur = nodes.find(n => n.id === nodeId)
  while (cur) {
    path.unshift(cur)
    cur = cur.parentId ? nodes.find(n => n.id === cur!.parentId) : undefined
  }
  return path
}

// ─── Props ────────────────────────────────────────────────────

interface Props {
  bookId: string
  bookTitle: string
  initialJson: string | null
  onClose: () => void
  readonly?: boolean
}

export default function BookMindMap({ bookId, bookTitle, initialJson, onClose, readonly = false }: Props) {
  const initNodes = (): MindNode[] => {
    if (initialJson) {
      try {
        const p = JSON.parse(initialJson)
        if (Array.isArray(p) && p.length) return p
      } catch {}
    }
    return [{ id: 'root', label: bookTitle, parentId: null, x: 60, y: 380 }]
  }

  const [nodes, setNodes]           = useState<MindNode[]>(initNodes)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editLabel, setEditLabel]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importTargetId, setImportTargetId] = useState('root')
  const [canUndo, setCanUndo]       = useState(false)
  const [isDirty, setIsDirty]       = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [traversalIdx, setTraversalIdx] = useState<number | null>(null)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())

  const [copySuccess, setCopySuccess] = useState(false)

  function handleClose() {
    if (isDirty && !isReadOnly) { setShowCloseConfirm(true); return }
    onClose()
  }

  function toggleCollapse(nodeId: string) {
    setCollapsedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  function exportMarkdown() {
    const md = nodesToMarkdown(nodes)
    navigator.clipboard.writeText(md).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }).catch(() => {
      // Fallback: open in a new tab as a data URI so user can copy manually
      const blob = new Blob([md], { type: 'text/plain' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${bookTitle.replace(/\s+/g, '_')}_mindmap.md`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  // Read-only toggle — starts in the mode passed via prop
  const [isReadOnly, setIsReadOnly] = useState(readonly)

  // Reparent mode: ID of the node being moved to a new parent
  const [reparentId, setReparentId] = useState<string | null>(null)

  // ── Search ────────────────────────────────────────────────
  const [showSearch, setShowSearch]       = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchMatchIdx, setSearchMatchIdx] = useState(0)
  const searchInputRef   = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const visibleNodes = useMemo(() => {
    function isVisible(nodeId: string): boolean {
      const node = nodes.find(n => n.id === nodeId)
      if (!node || !node.parentId) return true
      if (collapsedNodes.has(node.parentId)) return false
      return isVisible(node.parentId)
    }
    return nodes.filter(n => isVisible(n.id))
  }, [nodes, collapsedNodes])

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return visibleNodes.filter(n => n.label.toLowerCase().includes(q))
  }, [visibleNodes, searchQuery])

  const matchIds = useMemo(() => new Set(searchMatches.map(n => n.id)), [searchMatches])

  // Refs for traversal — read inside the keydown handler without stale closures
  const traversalIdxRef = useRef(traversalIdx)
  traversalIdxRef.current = traversalIdx
  const dfsLengthRef   = useRef(0)            // kept in sync after dfsOrder is computed below
  const dfsOrderRef    = useRef<MindNode[]>([]) // kept in sync after dfsOrder is computed below

  // Pre-order DFS traversal: root → first child → deepest → next sibling (top-to-bottom)
  const dfsOrder = useMemo(() => {
    const result: MindNode[] = []
    function dfs(nodeId: string) {
      const node = visibleNodes.find(n => n.id === nodeId)
      if (!node) return
      result.push(node)
      visibleNodes.filter(n => n.parentId === nodeId).sort((a, b) => a.y - b.y).forEach(c => dfs(c.id))
    }
    dfs('root')
    return result
  }, [visibleNodes])
  dfsLengthRef.current  = dfsOrder.length
  dfsOrderRef.current   = dfsOrder

  // Keep focused match index in bounds when matches change
  useEffect(() => {
    setSearchMatchIdx(prev => (searchMatches.length ? Math.min(prev, searchMatches.length - 1) : 0))
  }, [searchMatches])

  // Scroll canvas to keep the focused match visible
  useEffect(() => {
    const node = searchMatches[searchMatchIdx]
    if (!node || !scrollContainerRef.current) return
    const c  = scrollContainerRef.current
    const nw = nodeWidth(node.label)
    c.scrollTo({
      left: Math.max(0, node.x + nw / 2 - c.clientWidth / 2),
      top:  Math.max(0, node.y + NODE_H / 2 - c.clientHeight / 2),
      behavior: 'smooth',
    })
  }, [searchMatchIdx, searchMatches])

  // Focus input when search bar opens
  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50)
    else setSearchQuery('')
  }, [showSearch])

  function openSearch() { setShowSearch(true) }
  function closeSearch() { setShowSearch(false) }
  function nextMatch()   { setSearchMatchIdx(i => (i + 1) % searchMatches.length) }
  function prevMatch()   { setSearchMatchIdx(i => (i - 1 + searchMatches.length) % searchMatches.length) }

  // ── Undo history ──────────────────────────────────────────
  const historyRef = useRef<MindNode[][]>([])
  const nodesRef   = useRef(nodes)
  nodesRef.current = nodes

  // Keep a ref so the popstate handler always sees the latest isDirty value
  // without needing to be recreated every time it changes
  const isDirtyRef = useRef(false)
  isDirtyRef.current = isDirty

  // Warn on browser refresh / tab close when unsaved
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current && !isReadOnly) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  // isReadOnly won't change after mount in practice; isDirtyRef handles the rest
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Intercept the browser back button when unsaved.
  // Push a dummy history entry on mount so pressing Back triggers popstate
  // instead of immediately leaving. If dirty, push it back again and show
  // our own confirm dialog instead of navigating away.
  useEffect(() => {
    history.pushState({ mindmap: true }, '')

    function onPopState() {
      if (isDirtyRef.current) {
        history.pushState({ mindmap: true }, '')
        setShowCloseConfirm(true)
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pushHistory() {
    historyRef.current = [...historyRef.current.slice(-49), [...nodesRef.current]]
    setCanUndo(true)
    setIsDirty(true)
  }

  const undo = useCallback(() => {
    if (!historyRef.current.length) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    setNodes(prev)
    setCanUndo(historyRef.current.length > 0)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'

      // ⌘F / Ctrl+F — open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
        return
      }
      if (e.key === 'Escape') {
        if (showSearch) { closeSearch(); return }
        if (traversalIdxRef.current !== null) { setTraversalIdx(null); return }
        setReparentId(null)
        return
      }
      // Navigate search matches while search is open
      if (showSearch && searchMatches.length > 0) {
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); nextMatch(); return }
        if ((e.shiftKey && e.key === 'Enter') || e.key === 'ArrowUp') { e.preventDefault(); prevMatch(); return }
      }
      // Arrow-key tree traversal (when traversal is active and no input is focused)
      if (traversalIdxRef.current !== null && !showSearch && !inInput) {
        // ← / → walk the DFS pre-order sequence (previous / next node overall)
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setTraversalIdx(i => Math.min(dfsLengthRef.current - 1, (i ?? 0) + 1))
          return
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setTraversalIdx(i => Math.max(0, (i ?? 0) - 1))
          return
        }
        // ↑ / ↓ jump to the previous / next sibling at the same level
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const cur = dfsOrderRef.current[traversalIdxRef.current]
          if (cur) {
            const siblings = nodesRef.current
              .filter(n => n.parentId === cur.parentId)
              .sort((a, b) => a.y - b.y)
            const si = siblings.findIndex(n => n.id === cur.id)
            const target = e.key === 'ArrowUp' ? siblings[si - 1] : siblings[si + 1]
            if (target) {
              const newIdx = dfsOrderRef.current.findIndex(n => n.id === target.id)
              if (newIdx !== -1) setTraversalIdx(newIdx)
            }
          }
          return
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, showSearch, searchMatches])

  // Reset import target when dialog opens
  useEffect(() => {
    if (showImport) setImportTargetId('root')
  }, [showImport])

  // Mobile breakpoint detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Auto-scroll to root node on first render
  useEffect(() => {
    const root = nodes.find(n => n.id === 'root')
    if (!root || !scrollContainerRef.current) return
    const c = scrollContainerRef.current
    setTimeout(() => {
      c.scrollTo({
        left: Math.max(0, root.x - 40),
        top:  Math.max(0, root.y + NODE_H / 2 - c.clientHeight / 2),
        behavior: 'smooth',
      })
    }, 150)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll canvas to keep the traversal-focused node centered, and clamp index on tree changes
  useEffect(() => {
    if (traversalIdx === null) return
    if (traversalIdx >= dfsOrder.length) {
      setTraversalIdx(Math.max(0, dfsOrder.length - 1))
      return
    }
    const node = dfsOrder[traversalIdx]
    if (!node || !scrollContainerRef.current) return
    const c  = scrollContainerRef.current
    const nw = nodeWidth(node.label)
    c.scrollTo({
      left: Math.max(0, node.x + nw / 2 - c.clientWidth / 2),
      top:  Math.max(0, node.y + NODE_H / 2 - c.clientHeight / 2),
      behavior: 'smooth',
    })
  }, [traversalIdx, dfsOrder])

  // ── Import ────────────────────────────────────────────────

  function handleImportAdd() {
    const added = appendBranches(importText, nodesRef.current, importTargetId)
    if (!added) { setImportError('Could not parse. Paste an indented outline or Markdown headings (# ## ###).'); return }
    pushHistory()
    setNodes(prev => [...prev, ...added])
    setImportText(''); setImportError(null); setShowImport(false)
  }

  function handleImportReplace() {
    const tree = parseImportText(importText)
    if (!tree) { setImportError('Could not parse. Paste an indented outline or Markdown headings (# ## ###).'); return }
    const root = nodesRef.current.find(n => n.id === 'root')
    const newNodes = treeToNodes(tree, 'root', root?.x ?? 60)
    const rootNode = newNodes.find(n => n.id === 'root')
    if (rootNode) rootNode.label = bookTitle
    pushHistory()
    setNodes(newNodes)
    setCollapsedNodes(new Set())
    setImportText(''); setImportError(null); setShowImport(false)
  }

  // ── Reparent ──────────────────────────────────────────────

  function startReparent(nodeId: string) {
    setReparentId(nodeId)
    // Clear any active edit
    setEditingId(null)
  }

  function completeReparent(targetId: string) {
    if (!reparentId) return
    // Same node — cancel
    if (targetId === reparentId) { setReparentId(null); return }
    // Can't reparent to own descendant (would create a cycle)
    if (isDescendant(targetId, reparentId, nodesRef.current)) { setReparentId(null); return }
    pushHistory()
    setNodes(prev => prev.map(n => n.id === reparentId ? { ...n, parentId: targetId } : n))
    setReparentId(null)
  }

  // ── Insert between node and all its children ──────────────
  function insertBetweenChildren(node: MindNode) {
    const children = nodesRef.current.filter(n => n.parentId === node.id)
    if (!children.length) return
    pushHistory()
    const newId  = uid()
    const avgY   = children.reduce((s, c) => s + c.y + NODE_H / 2, 0) / children.length - NODE_H / 2
    const newNode: MindNode = {
      id: newId, label: 'New level', parentId: node.id,
      x: node.x + H_GAP, y: avgY,
    }
    setNodes(prev => [
      ...prev.map(n => n.parentId === node.id ? { ...n, parentId: newId } : n),
      newNode,
    ])
    setTimeout(() => { setEditingId(newId); setEditLabel('New level') }, 20)
  }

  // ── Drag / connect refs ───────────────────────────────────
  const moveRef      = useRef<{ id: string; ox: number; oy: number; mx: number; my: number } | null>(null)
  const connRef      = useRef<{ fromId: string } | null>(null)
  const touchMoveRef = useRef<{ id: string; ox: number; oy: number; startTX: number; startTY: number } | null>(null)
  const lastTouchRef = useRef(0)
  const [connPos, setConnPos] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  function canvasXY(clientX: number, clientY: number): { x: number; y: number } {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (moveRef.current) {
        const { id, ox, oy, mx, my } = moveRef.current
        const dx = e.clientX - mx
        const dy = e.clientY - my
        setNodes(prev =>
          prev.map(n => n.id === id ? { ...n, x: Math.max(4, ox + dx), y: Math.max(4, oy + dy) } : n)
        )
      }
      if (connRef.current) setConnPos(canvasXY(e.clientX, e.clientY))
    }

    function handleMouseUp(e: MouseEvent) {
      if (connRef.current) {
        const { fromId } = connRef.current
        const { x, y } = canvasXY(e.clientX, e.clientY)
        const from = nodesRef.current.find(n => n.id === fromId)
        if (from) {
          const dist = Math.hypot(x - (from.x + nodeWidth(from.label)), y - (from.y + NODE_H / 2))
          if (dist > 24) {
            pushHistory()
            const newId = uid()
            const newNode: MindNode = {
              id: newId, label: 'New point', parentId: fromId,
              x: Math.max(8, x - MIN_W / 2), y: Math.max(8, y - NODE_H / 2),
            }
            setNodes(prev => [...prev, newNode])
            setTimeout(() => { setEditingId(newId); setEditLabel('New point') }, 20)
          }
        }
        connRef.current = null
        setConnPos(null)
      }
      moveRef.current = null
    }

    function handleTouchMove(e: TouchEvent) {
      if (touchMoveRef.current && e.touches.length === 1) {
        const touch = e.touches[0]
        const { id, ox, oy, startTX, startTY } = touchMoveRef.current
        const dx = touch.clientX - startTX
        const dy = touch.clientY - startTY
        setNodes(prev =>
          prev.map(n => n.id === id ? { ...n, x: Math.max(4, ox + dx), y: Math.max(4, oy + dy) } : n)
        )
        e.preventDefault()
      }
    }

    function handleTouchEnd() {
      touchMoveRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  function startMove(e: React.MouseEvent, node: MindNode) {
    if (node.id === 'root' || isReadOnly || reparentId) return
    if (Date.now() - lastTouchRef.current < 500) return // skip synthesized mouse events after touch
    pushHistory()
    moveRef.current = { id: node.id, ox: node.x, oy: node.y, mx: e.clientX, my: e.clientY }
    e.stopPropagation()
    e.preventDefault()
  }

  function startTouchMove(e: React.TouchEvent, node: MindNode) {
    if (node.id === 'root' || isReadOnly || reparentId) return
    const touch = e.touches[0]
    lastTouchRef.current = Date.now()
    pushHistory()
    touchMoveRef.current = { id: node.id, ox: node.x, oy: node.y, startTX: touch.clientX, startTY: touch.clientY }
    e.stopPropagation()
  }

  function startConn(e: React.MouseEvent, fromId: string) {
    connRef.current = { fromId }
    setConnPos(canvasXY(e.clientX, e.clientY))
    e.stopPropagation()
    e.preventDefault()
  }

  function commitEdit(id: string) {
    pushHistory()
    const label = editLabel.trim()
    if (label) {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, label } : n))
    } else {
      deleteNode(id, false)
    }
    setEditingId(null)
  }

  function deleteNode(id: string, withHistory = true) {
    if (id === 'root') return
    if (withHistory) pushHistory()
    const toDelete = new Set<string>()
    const collect = (nid: string) => {
      toDelete.add(nid)
      nodesRef.current.filter(n => n.parentId === nid).forEach(c => collect(c.id))
    }
    collect(id)
    setNodes(prev => prev.filter(n => !toDelete.has(n.id)))
    if (editingId && toDelete.has(editingId)) setEditingId(null)
    setCollapsedNodes(prev => {
      const next = new Set(prev)
      toDelete.forEach(id => next.delete(id))
      return next
    })
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
      setSaveError('Run in Supabase SQL editor: ALTER TABLE reading_log ADD COLUMN IF NOT EXISTS key_lessons TEXT;')
      return
    }
    setIsDirty(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const canvasW = Math.max(2400, Math.max(...nodes.map(n => n.x + nodeWidth(n.label))) + 400)
  const canvasH = Math.max(1600, Math.max(...nodes.map(n => n.y + NODE_H)) + 400)

  const nodesWithChildren = new Set(nodes.filter(n => n.parentId).map(n => n.parentId!))

  // Sorted node list for the import target selector (root first, then alphabetical)
  const sortedNodesForSelect = [
    ...nodes.filter(n => n.id === 'root'),
    ...nodes.filter(n => n.id !== 'root').sort((a, b) => a.label.localeCompare(b.label)),
  ]

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#090912' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8 bg-black/40 backdrop-blur shrink-0">
        <GitBranch className="h-4 w-4 text-violet-400 shrink-0" />
        <p className="text-sm font-semibold text-white truncate flex-1 min-w-0">{bookTitle}</p>

        {/* Desktop toolbar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">Mind Map</span>

          <button
            onClick={() => { setIsReadOnly(r => !r); setReparentId(null) }}
            title={isReadOnly ? 'Switch to edit mode' : 'Switch to read-only mode'}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all',
              isReadOnly
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            )}
          >
            {isReadOnly ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {isReadOnly ? 'Read Only' : 'View'}
          </button>

          {!isReadOnly && (
            <>
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </button>

              <button
                onClick={() => { setShowImport(true); setImportError(null) }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all"
              >
                <Upload className="h-3 w-3" />
                Import
              </button>

              <button
                onClick={save}
                disabled={saving}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  savedFlash
                    ? 'bg-emerald-600 text-white'
                    : 'bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50'
                )}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" />
                  : savedFlash ? <Check className="h-3 w-3" /> : null}
                {savedFlash ? 'Saved!' : 'Save'}
              </button>
            </>
          )}

          <button
            onClick={() => setShowSearch(s => !s)}
            title="Search nodes (⌘F)"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all',
              showSearch
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            )}
          >
            <Search className="h-3 w-3" />
            Search
          </button>

          <button
            onClick={exportMarkdown}
            title="Copy as Markdown (# ## ### headings)"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all',
              copySuccess
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            )}
          >
            {copySuccess ? <Check className="h-3 w-3" /> : <Download className="h-3 w-3" />}
            {copySuccess ? 'Copied!' : 'Export'}
          </button>

          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile compact toolbar */}
        <div className="flex sm:hidden items-center gap-0.5 shrink-0">
          {/* Edit / View toggle icon-only */}
          <button
            onClick={() => { setIsReadOnly(r => !r); setReparentId(null) }}
            title={isReadOnly ? 'Switch to edit mode' : 'Switch to read-only mode'}
            className={cn(
              'rounded-lg p-2 transition-colors',
              isReadOnly ? 'text-amber-300 bg-amber-500/15' : 'text-slate-400 hover:text-white hover:bg-white/10'
            )}
          >
            {isReadOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>

          {/* Save icon-only (edit mode only) */}
          {!isReadOnly && (
            <button
              onClick={save}
              disabled={saving}
              className={cn(
                'rounded-lg p-2 transition-colors disabled:opacity-50',
                savedFlash ? 'text-emerald-400' : 'text-violet-400 hover:text-violet-300 hover:bg-white/10'
              )}
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : savedFlash ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            </button>
          )}

          {/* More menu (Undo · Import · Search · Export) */}
          <div className="relative">
            {showMobileMenu && (
              <div className="fixed inset-0 z-[29]" onClick={() => setShowMobileMenu(false)} />
            )}
            <button
              onClick={() => setShowMobileMenu(m => !m)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                showMobileMenu ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMobileMenu && (
              <div className="absolute right-0 top-full mt-1 z-30 rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1.5 min-w-[160px]">
                {!isReadOnly && (
                  <button
                    onClick={() => { undo(); setShowMobileMenu(false) }}
                    disabled={!canUndo}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40 transition-colors"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Undo
                  </button>
                )}
                {!isReadOnly && (
                  <button
                    onClick={() => { setShowImport(true); setImportError(null); setShowMobileMenu(false) }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" /> Import
                  </button>
                )}
                <button
                  onClick={() => { setShowSearch(s => !s); setShowMobileMenu(false) }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-white/5 transition-colors',
                    showSearch ? 'text-amber-300' : 'text-slate-300'
                  )}
                >
                  <Search className="h-3.5 w-3.5" /> Search
                </button>
                <button
                  onClick={() => { exportMarkdown(); setShowMobileMenu(false) }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                >
                  {copySuccess
                    ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                    : <Download className="h-3.5 w-3.5" />}
                  {copySuccess ? 'Copied!' : 'Export'}
                </button>
              </div>
            )}
          </div>

          {/* Close */}
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Search bar ── */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-500/20 bg-amber-500/5 shrink-0">
          <Search className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchMatchIdx(0) }}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); e.shiftKey ? prevMatch() : nextMatch() }
              if (e.key === 'Escape') { e.preventDefault(); closeSearch() }
            }}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none"
          />
          {/* Match counter */}
          {searchQuery.trim() && (
            <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">
              {searchMatches.length === 0
                ? 'No matches'
                : `${searchMatchIdx + 1} / ${searchMatches.length}`}
            </span>
          )}
          {/* Prev / Next */}
          <button
            onClick={prevMatch}
            disabled={searchMatches.length < 2}
            title="Previous match (Shift+Enter)"
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={nextMatch}
            disabled={searchMatches.length < 2}
            title="Next match (Enter)"
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={closeSearch} className="p-1 rounded text-slate-500 hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Reparent mode banner ── */}
      {reparentId && !isReadOnly && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-500/20 bg-cyan-500/10 shrink-0">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <p className="text-xs text-cyan-300">
              <span className="font-semibold">Move branch: </span>
              click any node to attach &ldquo;{nodesRef.current.find(n => n.id === reparentId)?.label ?? '…'}&rdquo; there
            </p>
          </div>
          <button
            onClick={() => setReparentId(null)}
            className="text-xs text-cyan-500 hover:text-cyan-200 transition-colors shrink-0"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* ── Hint / error bar ── */}
      {saveError ? (
        <div className="px-4 py-2 border-b border-red-500/20 bg-red-500/10 shrink-0 flex items-start gap-2">
          <p className="text-[11px] text-red-400 flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-300 shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : !reparentId && (
        <div className="px-4 py-1.5 border-b border-white/5 bg-white/[0.015] shrink-0">
          {isReadOnly ? (
            <p className="text-[11px] text-slate-600">
              <span className="text-amber-500">Read-only</span> —{' '}
              <span className="hidden sm:inline">click <span className="text-amber-400">View</span> in the header</span>
              <span className="sm:hidden">tap the eye icon</span> to switch to edit mode
            </p>
          ) : (
            <>
              <p className="hidden sm:block text-[11px] text-slate-600">
                Drag <span className="text-violet-500">●</span> right edge to branch &nbsp;·&nbsp;
                <span className="text-violet-500">✎</span> edit &nbsp;·&nbsp;
                <span className="text-amber-500">＋</span> inject level &nbsp;·&nbsp;
                <span className="text-cyan-500">⇌</span> move branch &nbsp;·&nbsp;
                <span className="text-violet-400">◉</span> collapse/expand &nbsp;·&nbsp;
                ⌘Z undo
              </p>
              <p className="sm:hidden text-[11px] text-slate-600">
                <span className="text-violet-500">Tap</span> node to edit &nbsp;·&nbsp;
                <span className="text-violet-500">Hold &amp; drag</span> to move &nbsp;·&nbsp;
                Drag <span className="text-violet-500">●</span> right edge to branch
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Import overlay ── */}
      {showImport && !isReadOnly && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-slate-900 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Import outline</p>
                <p className="text-xs text-slate-500 mt-0.5">Paste an indented outline or Markdown headings</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 space-y-2">
              <p className="text-[11px] font-medium text-slate-400">How to get the text from NotebookLM</p>
              <p className="text-[11px] text-slate-500">In the NotebookLM chat, type:</p>
              <div className="rounded bg-black/40 border border-white/10 px-2.5 py-1.5 text-[11px] text-violet-300 font-mono cursor-text select-all">
                Give me the mind map as an indented text outline with all topics and subtopics
              </div>
              <p className="text-[11px] text-slate-500">Copy the response and paste it below. Also supports Markdown headings (# ## ###) and bullet lists (- *).</p>
            </div>

            {/* Target node selector */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-400">Attach imported branches to</p>
              <select
                value={importTargetId}
                onChange={e => setImportTargetId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50 appearance-none"
              >
                {sortedNodesForSelect.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.id === 'root' ? `⬤ ${n.label} (root)` : `  ${n.label}`}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-600">
                "Add branches" will attach the imported outline as children of the selected node
              </p>
            </div>

            <textarea
              autoFocus
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportError(null) }}
              placeholder={`# Book Title\n## Chapter 1\n### Key idea\n### Another idea\n## Chapter 2`}
              className="w-full h-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-700 font-mono focus:outline-none focus:border-violet-500/50 resize-none"
            />

            {importError && <p className="text-xs text-red-400">{importError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setShowImport(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportReplace}
                disabled={!importText.trim()}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300 disabled:opacity-40 transition-colors"
                title="Discard existing map and build from this text"
              >
                Replace map
              </button>
              <button
                onClick={handleImportAdd}
                disabled={!importText.trim()}
                className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 py-2 text-xs font-medium text-white transition-colors"
              >
                Add branches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scrollable canvas ── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div
          ref={canvasRef}
          className="relative select-none"
          style={{
            width: canvasW,
            height: canvasH,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >

          {/* ── SVG edges ── */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={canvasW} height={canvasH}
            style={{ overflow: 'visible' }}
          >
            {visibleNodes.filter(n => n.parentId).map(child => {
              const parent = nodesRef.current.find(p => p.id === child.parentId)
              if (!parent) return null
              const d = getDepth(child.id, nodesRef.current)
              const color = DEPTH_COLORS[d % DEPTH_COLORS.length]
              // Dim the edge of the branch being reparented
              const isDimmed = reparentId
                ? child.id === reparentId || isDescendant(child.id, reparentId, nodesRef.current)
                : false
              return (
                <path key={`edge-${child.id}`}
                  d={bezier(parent, child)} fill="none"
                  stroke={isDimmed ? '#374151' : color}
                  strokeWidth={1.5}
                  strokeOpacity={isDimmed ? 0.3 : 0.4}
                  strokeDasharray={isDimmed ? '5 4' : undefined}
                />
              )
            })}

            {connRef.current && connPos && (() => {
              const from = nodesRef.current.find(n => n.id === connRef.current!.fromId)
              if (!from) return null
              const fakeChild: MindNode = {
                id: '__tmp__', label: '', parentId: null,
                x: connPos.x - MIN_W / 2, y: connPos.y - NODE_H / 2,
              }
              return (
                <path d={bezier(from, fakeChild)} fill="none"
                  stroke="#7c3aed" strokeWidth={2} strokeDasharray="7 5" strokeOpacity={0.7} />
              )
            })()}
          </svg>

          {/* ── Nodes ── */}
          {visibleNodes.map(node => {
            const isRoot        = node.id === 'root'
            const isEditing     = editingId === node.id
            const d             = getDepth(node.id, nodes)
            const color         = DEPTH_COLORS[d % DEPTH_COLORS.length]
            const hasChildren   = nodesWithChildren.has(node.id)
            const nw            = nodeWidth(node.label)

            // Reparent mode states
            const isBeingMoved  = reparentId === node.id
            const isValidTarget = !!reparentId && node.id !== reparentId && !isDescendant(node.id, reparentId, nodesRef.current)

            // Search highlight states
            const isSearchMatch    = matchIds.has(node.id)
            const isSearchFocus    = isSearchMatch && searchMatches[searchMatchIdx]?.id === node.id
            const isTraversalFocus = traversalIdx !== null && dfsOrder[traversalIdx]?.id === node.id

            return (
              <div
                key={node.id}
                className={cn(
                  'absolute group flex items-center gap-1 rounded-lg border px-2.5',
                  'transition-all duration-150',
                  isBeingMoved
                    ? 'shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-pulse z-20'
                    : isTraversalFocus
                      ? 'shadow-[0_0_26px_rgba(52,211,153,0.55)] z-20'
                      : isSearchFocus
                        ? 'shadow-[0_0_22px_rgba(251,191,36,0.6)] z-20'
                        : isSearchMatch
                          ? 'shadow-[0_0_12px_rgba(251,191,36,0.3)] z-10'
                          : isValidTarget
                            ? 'cursor-pointer hover:shadow-[0_0_18px_rgba(6,182,212,0.45)] hover:z-10'
                            : 'hover:shadow-[0_0_16px_rgba(124,58,237,0.35)] hover:z-10',
                  !isReadOnly && !reparentId && !isRoot ? 'cursor-move' : '',
                  isReadOnly ? 'cursor-default' : '',
                )}
                style={{
                  left: node.x, top: node.y, width: nw, height: NODE_H,
                  borderColor: isBeingMoved
                    ? 'rgba(6,182,212,0.7)'
                    : isTraversalFocus
                      ? 'rgba(52,211,153,0.85)'
                      : isSearchFocus
                        ? 'rgba(251,191,36,0.8)'
                        : isSearchMatch
                          ? 'rgba(251,191,36,0.4)'
                          : isValidTarget && reparentId
                            ? 'rgba(6,182,212,0.35)'
                            : isRoot
                              ? 'rgba(124,58,237,0.55)'
                              : color + '44',
                  background: isBeingMoved
                    ? 'rgba(6,182,212,0.15)'
                    : isTraversalFocus
                      ? 'rgba(6,78,59,0.30)'
                      : isSearchFocus
                        ? 'rgba(251,191,36,0.12)'
                        : isRoot
                          ? 'rgba(109,40,217,0.25)'
                          : 'rgba(12,12,26,0.88)',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseDown={isReadOnly || reparentId || isRoot ? undefined : e => startMove(e, node)}
                onTouchStart={isReadOnly || reparentId || isRoot ? undefined : e => startTouchMove(e, node)}
                onClick={
                  reparentId && !isBeingMoved
                    ? () => completeReparent(node.id)
                    : (isMobile && traversalIdx !== null && !isEditing)
                      ? () => { const idx = dfsOrder.findIndex(n => n.id === node.id); if (idx !== -1) setTraversalIdx(idx) }
                      : (isMobile && !isReadOnly && !isRoot && !isEditing)
                        ? () => { setEditingId(node.id); setEditLabel(node.label) }
                        : undefined
                }
              >
                {/* Tooltip — always show full label on hover */}
                {!isEditing && (
                  <div
                    className="pointer-events-none absolute left-0 bottom-[calc(100%+5px)] hidden group-hover:block z-20 max-w-[400px] rounded-lg border border-white/15 bg-slate-800/95 px-3 py-2 text-xs leading-relaxed shadow-xl backdrop-blur-sm whitespace-normal break-words"
                    style={{ color }}
                  >
                    <HighlightedLabel text={node.label} query={searchQuery} />
                  </div>
                )}

                {/* "Drop here" indicator in reparent mode */}
                {isValidTarget && (
                  <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-cyan-400/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-cyan-400 font-semibold bg-slate-900/80 px-1.5 py-0.5 rounded">
                      Attach here
                    </span>
                  </div>
                )}

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
                    style={{ color: isBeingMoved ? '#67e8f9' : isTraversalFocus ? '#6ee7b7' : isSearchFocus ? '#fef3c7' : isRoot ? '#c4b5fd' : color }}
                  >
                    <HighlightedLabel text={node.label} query={searchQuery} />
                  </span>
                )}

                {/* Collapse/expand — available in any mode for nodes with children */}
                {hasChildren && !reparentId && !isEditing && (
                  <button
                    type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); toggleCollapse(node.id) }}
                    title={collapsedNodes.has(node.id) ? 'Expand children' : 'Collapse children'}
                    className={cn(
                      'shrink-0 flex items-center justify-center w-4 h-4 rounded-full border transition-all',
                      collapsedNodes.has(node.id)
                        ? 'opacity-100 border-violet-500/60 bg-violet-500/20 text-violet-400 hover:bg-violet-500/35'
                        : 'opacity-0 group-hover:opacity-100 border-slate-600/40 bg-slate-800/60 text-slate-500 hover:border-violet-500/50 hover:bg-violet-500/15 hover:text-violet-400'
                    )}
                  >
                    {collapsedNodes.has(node.id)
                      ? <ChevronRight className="h-2.5 w-2.5" />
                      : <ChevronDown className="h-2.5 w-2.5" />}
                  </button>
                )}

                {/* Edit controls — hidden in readonly or reparent mode */}
                {!isReadOnly && !reparentId && !isEditing && (
                  <>
                    {/* Insert-between button — only for nodes that have children */}
                    {hasChildren && (
                      <button
                        type="button"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); insertBetweenChildren(node) }}
                        title="Insert a new level between this node and its children (⌘Z to undo)"
                        className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center w-4 h-4 rounded-full border border-amber-500/60 bg-amber-500/15 text-amber-400 hover:bg-amber-500/40 transition-all"
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                    )}

                    {/* Move-branch (reparent) button */}
                    {!isRoot && (
                      <button
                        type="button"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); startReparent(node.id) }}
                        title="Move this branch to another node"
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-cyan-400 transition-all"
                      >
                        <Link2 className="h-2.5 w-2.5" />
                      </button>
                    )}

                    {/* Edit label button */}
                    {!isRoot && (
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

                    {/* Delete button */}
                    {!isRoot && (
                      <button
                        type="button"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </>
                )}

                {/* Navigate-from-here handle (left edge) — always available, any mode */}
                {!reparentId && !isEditing && (
                  <div
                    className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center cursor-pointer"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      const idx = dfsOrder.findIndex(n => n.id === node.id)
                      if (idx !== -1) setTraversalIdx(idx)
                    }}
                  >
                    <div className={cn(
                      'w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all',
                      isTraversalFocus
                        ? 'opacity-100 border-emerald-500/70 bg-emerald-500/25 text-emerald-400'
                        : 'opacity-0 group-hover:opacity-100 border-slate-600/50 bg-slate-800/70 text-slate-500 hover:border-emerald-500/60 hover:bg-emerald-500/15 hover:text-emerald-400'
                    )}>
                      <Navigation className="h-2 w-2" />
                    </div>
                  </div>
                )}

                {/* Connect handle (right edge) — hidden in readonly or reparent mode */}
                {!isReadOnly && !reparentId && (
                  <div
                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={e => startConn(e, node.id)}
                  >
                    <div className={cn(
                      'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                      'border-violet-500/60 bg-violet-600/20',
                      'hover:bg-violet-500 hover:border-violet-400 transition-colors'
                    )}>
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tree navigation bar (all screen sizes) ── */}
      <div className="flex flex-col border-t border-white/8 bg-[#06060f]/95 backdrop-blur shrink-0">
        {traversalIdx === null ? (
          /* Dormant state — slim trigger */
          <button
            onClick={() => setTraversalIdx(0)}
            className="flex items-center justify-center gap-2 py-2 text-xs text-slate-600 hover:text-slate-300 active:text-white transition-colors"
          >
            <Navigation className="h-3 w-3" />
            <span>Navigate tree</span>
            <span className="hidden sm:inline text-slate-700">· hover node and click <Navigation className="inline h-2.5 w-2.5 mb-0.5" /> to start from any node</span>
          </button>
        ) : (
          /* Active traversal */
          <>
            {/* Breadcrumb path */}
            <div className="flex items-center gap-0.5 px-4 pt-2.5 overflow-hidden min-w-0">
              {getAncestorPath(dfsOrder[traversalIdx]?.id ?? 'root', nodes).map((n, i, arr) => (
                <span key={n.id} className="flex items-center gap-0.5 min-w-0">
                  {i > 0 && <span className="text-slate-700 shrink-0 mx-0.5">›</span>}
                  <span
                    className={cn(
                      'text-[10px] truncate',
                      i === arr.length - 1
                        ? 'text-emerald-400 font-semibold max-w-[140px]'
                        : 'text-slate-600 max-w-[60px]'
                    )}
                  >
                    {n.label}
                  </span>
                </span>
              ))}
              <span className="ml-auto shrink-0 text-[10px] text-slate-600 pl-2">
                {traversalIdx + 1}/{dfsOrder.length}
              </span>
            </div>

            {/* Prev / label / Next / Close */}
            <div className="flex items-center gap-1 px-2 pb-2.5 pt-1">
              <button
                onClick={() => setTraversalIdx(i => Math.max(0, (i ?? 0) - 1))}
                disabled={traversalIdx === 0}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/8 text-slate-300 hover:bg-white/10 active:bg-white/15 disabled:opacity-25 transition-all shrink-0"
                title="Previous node (← ArrowLeft)"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex-1 min-w-0 text-center px-2">
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {dfsOrder[traversalIdx]?.label}
                </p>
                <div className="flex items-center justify-center gap-2 mt-0.5">
                  <p className="text-[10px] text-slate-600">
                    {getDepth(dfsOrder[traversalIdx]?.id ?? 'root', nodes) === 0
                      ? 'Root'
                      : `Depth ${getDepth(dfsOrder[traversalIdx]?.id ?? 'root', nodes)}`}
                  </p>
                  <span className="hidden sm:inline text-[10px] text-slate-700">← → traverse tree &nbsp;·&nbsp; ↑ ↓ same-level siblings &nbsp;·&nbsp; Esc exit</span>
                </div>
              </div>

              <button
                onClick={() => setTraversalIdx(i => Math.min(dfsOrder.length - 1, (i ?? 0) + 1))}
                disabled={traversalIdx === dfsOrder.length - 1}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/8 text-slate-300 hover:bg-white/10 active:bg-white/15 disabled:opacity-25 transition-all shrink-0"
                title="Next node (→ ArrowRight)"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => setTraversalIdx(null)}
                className="flex items-center justify-center w-7 h-7 ml-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all shrink-0"
                title="Exit navigation (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Unsaved changes confirm dialog */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
            <p className="text-base font-semibold text-white">Unsaved changes</p>
            <p className="text-sm text-slate-400">You have unsaved changes to this mind map. Save before closing?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCloseConfirm(false); onClose() }}
                className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={async () => { setShowCloseConfirm(false); await save(); onClose() }}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 py-2 text-sm font-medium text-white transition-colors"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
