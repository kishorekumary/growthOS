// Optional money allowance attached to a reward (migration 054). The
// Finance pages show rupees, so this does too.
export function formatSpend(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// Parse the optional amount field: '' → null (no amount), invalid or
// non-positive → undefined (reject), else the number.
export function parseSpend(raw: string): number | null | undefined {
  const t = raw.trim().replace(/[₹,\s]/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined
}
