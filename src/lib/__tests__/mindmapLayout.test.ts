import { describe, expect, it } from 'vitest'
import { autoLayout, focusScroll, LAYOUT, type LayoutNode } from '@/lib/mindmapLayout'

const n = (id: string, parentId: string | null, y: number, w = 200, h = 58): LayoutNode => ({ id, parentId, y, w, h })
const centre = (p: { y: number }, h = 58) => p.y + h / 2

// root ─┬─ a ─┬─ a1
//       │     └─ a2
//       └─ b ─── b1   (stored y spread far apart, as after an import)
const tree = [
  n('root', null, 5000),
  n('a', 'root', 100), n('a1', 'a', 0), n('a2', 'a', 9000),
  n('b', 'root', 20000), n('b1', 'b', 20000),
]

describe('autoLayout', () => {
  it('puts each depth in its own column, spaced by the widest node', () => {
    const wide = tree.map(x => x.id === 'a' ? { ...x, w: 500 } : x)
    const pos = autoLayout(wide, new Set())
    expect(pos.get('root')!.x).toBe(LAYOUT.originX)
    expect(pos.get('a')!.x).toBe(LAYOUT.originX + 200 + LAYOUT.colGap)
    expect(pos.get('b')!.x).toBe(pos.get('a')!.x)
    expect(pos.get('a1')!.x).toBe(pos.get('a')!.x + 500 + LAYOUT.colGap)
  })

  it('packs siblings into one contiguous block regardless of stored y', () => {
    const pos = autoLayout(tree, new Set())
    expect(pos.get('a2')!.y - pos.get('a1')!.y).toBe(58 + LAYOUT.rowGap)
    // b's subtree starts right after a's
    expect(pos.get('b1')!.y - pos.get('a2')!.y).toBe(58 + LAYOUT.rowGap)
  })

  it('keeps sibling order from stored y', () => {
    const swapped = tree.map(x => x.id === 'a1' ? { ...x, y: 99999 } : x)
    const pos = autoLayout(swapped, new Set())
    expect(pos.get('a2')!.y).toBeLessThan(pos.get('a1')!.y)
  })

  it('centres a parent on its children', () => {
    const pos = autoLayout(tree, new Set())
    expect(centre(pos.get('a')!)).toBe((centre(pos.get('a1')!) + centre(pos.get('a2')!)) / 2)
  })

  it('treats a collapsed branch as one row and omits its descendants', () => {
    const pos = autoLayout(tree, new Set(['a']))
    expect(pos.has('a1')).toBe(false)
    expect(pos.has('a2')).toBe(false)
    expect(pos.get('b')!.y - pos.get('a')!.y).toBe(58 + LAYOUT.rowGap)
  })

  it('keeps immediate children together however big the rest of the tree is', () => {
    const big: LayoutNode[] = [n('root', null, 0)]
    for (let c = 0; c < 8; c++) {
      big.push(n(`c${c}`, 'root', c * 10000))
      for (let k = 0; k < 40; k++) big.push(n(`c${c}k${k}`, `c${c}`, c * 10000 + k * 96))
    }
    const collapsed = new Set(big.filter(x => x.parentId === 'root').map(x => x.id))
    const pos = autoLayout(big, collapsed)
    const ys = Array.from({ length: 8 }, (_, c) => pos.get(`c${c}`)!.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBe(7 * (58 + LAYOUT.rowGap))
  })

  it('stacks free-floating nodes and orphans below the main tree', () => {
    const nodes = [...tree, n('free', null, 0), n('orphan', 'gone', 1)]
    const pos = autoLayout(nodes, new Set())
    const treeBottom = Math.max(...tree.map(x => pos.get(x.id)!.y + 58))
    expect(pos.get('free')!.x).toBe(LAYOUT.originX)
    expect(pos.get('free')!.y).toBeGreaterThanOrEqual(treeBottom + LAYOUT.treeGap)
    expect(pos.get('orphan')!.y).toBeGreaterThan(pos.get('free')!.y)
  })

  it('survives a parent cycle without looping', () => {
    const nodes = [n('root', null, 0), n('x', 'y', 1), n('y', 'x', 2)]
    const pos = autoLayout(nodes, new Set())
    expect(pos.get('root')).toEqual({ x: LAYOUT.originX, y: LAYOUT.originY })
  })
})

describe('focusScroll', () => {
  const parent = { x: 60, y: 1000, w: 200, h: 58 }
  const kids = [0, 1, 2].map(i => ({ x: 380, y: 920 + i * 76, w: 300, h: 58 }))

  it('centres the parent and children block when it fits', () => {
    const { left, top } = focusScroll(parent, kids, { w: 1400, h: 800 })
    expect(left).toBe(36)
    const blockMid = (920 - 24 + 920 + 2 * 76 + 58 + 24) / 2
    expect(top).toBe(blockMid - 400)
  })

  it('shows the top of the block when it is taller than the view', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ x: 380, y: 200 + i * 76, w: 300, h: 58 }))
    expect(focusScroll(parent, many, { w: 1400, h: 600 }).top).toBe(200 - 24)
  })

  it('on a narrow screen, scrolls to the children column', () => {
    expect(focusScroll(parent, kids, { w: 390, h: 800 }).left).toBe(380 - 56)
  })

  it('never scrolls to a negative offset', () => {
    expect(focusScroll({ x: 0, y: 0, w: 200, h: 58 }, [], { w: 390, h: 800 })).toEqual({ left: 0, top: 0 })
  })
})
