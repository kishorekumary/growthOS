// Which catalog rewards just became affordable, for the unlock popup.
// `seen` is the set of rewards that were affordable last time we looked
// (stored per device); null means we've never looked, so nothing is
// announced — rewards already affordable on first load aren't news.
// Rewards that drop out of reach (after redeeming) leave `seen`, so
// earning them again is celebrated again.

export interface UnlockCandidate { id: string; title: string; point_cost: number }

export function findUnlocks<T extends UnlockCandidate>(
  catalog: readonly T[], balance: number, seen: ReadonlySet<string> | null,
): { announce: T[]; nextSeen: string[] } {
  const affordable = catalog.filter(c => c.point_cost <= balance)
  const announce = seen === null
    ? []
    : affordable.filter(c => !seen.has(c.id)).sort((a, b) => b.point_cost - a.point_cost)
  return { announce, nextSeen: affordable.map(c => c.id) }
}
