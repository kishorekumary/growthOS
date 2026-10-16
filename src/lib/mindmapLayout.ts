// Compact "auto" layout for the book mind map (BookMindMap.tsx).
//
// Stored node positions come from laying out the *fully expanded* tree, so
// with branches collapsed a node's children can sit thousands of pixels
// apart. This lays out only what is visible instead: one column per depth,
// a collapsed branch takes a single row, and each node's children form one
// contiguous block centred on it. Siblings keep the order of their stored y.

export interface LayoutNode {
  id:       string
  parentId: string | null
  y:        number   // stored position; only used to order siblings
  w:        number
  h:        number
}

export interface Pt { x: number; y: number }

export const LAYOUT = {
  originX:  60,
  originY:  40,
  colGap:   120,  // clears the expand button and connect handle on the right edge
  rowGap:   18,   // between sibling subtrees
  treeGap:  80,   // between the main tree and free-floating nodes
} as const

export function autoLayout(
  nodes: readonly LayoutNode[],
  collapsed: ReadonlySet<string>,
  rootId = 'root',
): Map<string, Pt> {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const order = new Map(nodes.map((n, i) => [n.id, i]))
  const bySiblingOrder = (a: LayoutNode, b: LayoutNode) => a.y - b.y || order.get(a.id)! - order.get(b.id)!

  const childrenOf = new Map<string, LayoutNode[]>()
  for (const n of nodes) {
    if (n.parentId === null || !byId.has(n.parentId)) continue
    const list = childrenOf.get(n.parentId)
    if (list) list.push(n)
    else childrenOf.set(n.parentId, [n])
  }
  childrenOf.forEach(list => list.sort(bySiblingOrder))

  // Tops: the root first, then free-floating nodes (no parent, or a parent
  // that no longer exists) from top to bottom.
  const tops = nodes
    .filter(n => n.id !== rootId && (n.parentId === null || !byId.has(n.parentId)))
    .sort(bySiblingOrder)
  const root = byId.get(rootId)
  if (root) tops.unshift(root)

  // Visible children (none when collapsed). `seen` guards against cycles in
  // corrupted data — each node is laid out once.
  const seen = new Set<string>()
  const kidsOf = (id: string): LayoutNode[] => {
    if (collapsed.has(id)) return []
    return (childrenOf.get(id) ?? []).filter(k => !seen.has(k.id))
  }

  // Pass 1: depth of every visible node → widest node per column.
  const depth = new Map<string, number>()
  const colW: number[] = []
  const visit = (n: LayoutNode, d: number) => {
    seen.add(n.id)
    depth.set(n.id, d)
    colW[d] = Math.max(colW[d] ?? 0, n.w)
    for (const k of kidsOf(n.id)) visit(k, d + 1)
  }
  for (const t of tops) if (!seen.has(t.id)) visit(t, 0)

  const colX: number[] = []
  colW.forEach((_, d) => { colX[d] = d === 0 ? LAYOUT.originX : colX[d - 1] + colW[d - 1] + LAYOUT.colGap })

  // Pass 2: subtree heights, then place top-down. `kids` re-derives the
  // visible children from pass 1's depths so cycles stay broken.
  const kids = (id: string) =>
    collapsed.has(id) ? [] : (childrenOf.get(id) ?? []).filter(k => depth.get(k.id) === depth.get(id)! + 1)

  const heightMemo = new Map<string, number>()
  const subtreeH = (n: LayoutNode): number => {
    const memo = heightMemo.get(n.id)
    if (memo !== undefined) return memo
    const ks = kids(n.id)
    const block = ks.reduce((s, k) => s + subtreeH(k), 0) + LAYOUT.rowGap * Math.max(0, ks.length - 1)
    const h = Math.max(n.h, block)
    heightMemo.set(n.id, h)
    return h
  }

  const out = new Map<string, Pt>()
  const place = (n: LayoutNode, top: number) => {
    const H  = subtreeH(n)
    const ks = kids(n.id)
    const x  = colX[depth.get(n.id)!]
    if (!ks.length) { out.set(n.id, { x, y: top + (H - n.h) / 2 }); return }

    const block = ks.reduce((s, k) => s + subtreeH(k), 0) + LAYOUT.rowGap * (ks.length - 1)
    let cursor = top + (H - block) / 2
    for (const k of ks) { place(k, cursor); cursor += subtreeH(k) + LAYOUT.rowGap }

    // Centre on the span between the first and last child's centres.
    const first = out.get(ks[0].id)!, last = out.get(ks[ks.length - 1].id)!
    const mid = (first.y + ks[0].h / 2 + last.y + ks[ks.length - 1].h / 2) / 2
    out.set(n.id, { x, y: Math.min(Math.max(mid - n.h / 2, top), top + H - n.h) })
  }

  let cursor: number = LAYOUT.originY
  tops.forEach((t, i) => {
    if (depth.get(t.id) !== 0 || out.has(t.id)) return
    place(t, cursor)
    cursor += subtreeH(t) + (i === 0 ? LAYOUT.treeGap : LAYOUT.rowGap)
  })
  return out
}

// The scroll position that best shows `focus` and its immediate children.
// Vertically: the whole block centred if it fits, else its top. Horizontally:
// from the parent's left edge if parent + children fit side by side, else
// (phones) from just left of the children column, so the children are what
// you see — with a sliver of their incoming edges for context.
export function focusScroll(
  focus: Pt & { w: number; h: number },
  children: readonly (Pt & { w: number; h: number })[],
  view: { w: number; h: number },
  margin = 24,
): { left: number; top: number } {
  const boxes = [focus, ...children]
  const minY = Math.min(...boxes.map(b => b.y)) - margin
  const maxY = Math.max(...boxes.map(b => b.y + b.h)) + margin
  const maxX = Math.max(...boxes.map(b => b.x + b.w)) + margin
  const boxLeft = focus.x - margin

  const top = maxY - minY <= view.h ? (minY + maxY) / 2 - view.h / 2 : minY
  const left = maxX - boxLeft <= view.w || !children.length
    ? boxLeft
    : Math.min(...children.map(c => c.x)) - 56
  return { left: Math.max(0, left), top: Math.max(0, top) }
}
