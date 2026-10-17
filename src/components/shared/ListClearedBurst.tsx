'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { motionAllowed } from '@/lib/effects'

// Confetti + a "cleared" card for finishing a whole list (or, with a custom
// title/subtitle, any other moment worth a burst — e.g. redeeming a reward). Pieces only animate
// transform/opacity (GPU-composited), and the whole thing unmounts after
// ~2s, so it costs nothing once it's gone. With motion off: just the card.

const COLORS = ['#22c55e', '#a78bfa', '#fbbf24', '#38bdf8', '#f472b6']
const PIECE_COUNT = 40

interface Piece { id: number; x: number; y: number; rotate: number; delay: number; color: string; round: boolean }

function randomPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, id) => {
    const angle = Math.random() * Math.PI * 2
    const dist  = 120 + Math.random() * 160
    return {
      id,
      x: Math.round(Math.cos(angle) * dist),
      y: Math.round(Math.sin(angle) * dist * 0.8 - 60),
      rotate: Math.round(Math.random() * 900 - 450),
      delay: Math.round(Math.random() * 120) / 1000,
      color: COLORS[id % COLORS.length],
      round: id % 3 === 0,
    }
  })
}

interface PieceStyle extends CSSProperties { '--cx': string; '--cy': string; '--cr': string }

export default function ListClearedBurst({ label, title, subtitle = 'Everything checked off', emoji = '🎉', card = true }: {
  label?:    string
  title?:    string
  subtitle?: string
  emoji?:    string
  card?:     boolean  // false: confetti only, behind something else's own UI
}) {
  const [pieces] = useState<Piece[]>(randomPieces)
  const [motion, setMotion] = useState(true)

  useEffect(() => { setMotion(motionAllowed()) }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center overflow-hidden">
      {motion && pieces.map(p => (
        <span
          key={p.id}
          className={`confetti-piece absolute left-1/2 top-1/2 h-2.5 w-1.5 ${p.round ? 'rounded-full' : 'rounded-sm'}`}
          style={{
            background: p.color,
            '--cx': `${p.x}px`,
            '--cy': `${p.y}px`,
            '--cr': `${p.rotate}deg`,
            animationDelay: `${p.delay}s`,
          } as PieceStyle}
        />
      ))}
      {card && <div className="list-cleared-card rounded-2xl border border-emerald-400/30 bg-slate-900/90 px-6 py-4 text-center shadow-2xl backdrop-blur">
        <div className="text-3xl">{emoji}</div>
        <p className="mt-1 text-lg font-bold text-white">{title ?? `${label} cleared!`}</p>
        <p className="text-xs text-emerald-300">{subtitle}</p>
      </div>}
    </div>
  )
}
