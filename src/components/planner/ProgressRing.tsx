export default function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#22c55e 0 ${pct}%, rgb(var(--c-white) / 0.08) ${pct}% 100%)` }}
      aria-label={`${done} of ${total} done`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
        {pct}%
      </span>
    </div>
  )
}
