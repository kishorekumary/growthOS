'use client'

import { useEffect, useState, type CSSProperties } from 'react'

interface Coin {
  id: number
  left: number     // horizontal drift, in px
  rotate: number    // deg
  delay: number     // s
  duration: number  // s
}

const COIN_COUNT = 14

function randomCoins(): Coin[] {
  return Array.from({ length: COIN_COUNT }, (_, id) => ({
    id,
    left: Math.round((Math.random() - 0.5) * 220),   // -110px .. +110px
    rotate: Math.round(Math.random() * 720 - 360),    // -360deg .. +360deg
    delay: Math.round(Math.random() * 150) / 1000,    // 0 .. 0.15s
    duration: 0.9 + Math.random() * 0.5,              // 0.9 .. 1.4s
  }))
}

interface CoinStyle extends CSSProperties {
  '--coin-left': string
  '--coin-rotate': string
}

export default function CoinBurst() {
  const [coins] = useState<Coin[]>(randomCoins)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  if (reducedMotion) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center">
        <span className="coin-burst-pulse text-4xl">✅</span>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[300] overflow-hidden">
      {coins.map(coin => (
        <span
          key={coin.id}
          className="coin-burst-item absolute left-1/2 top-1/2 text-2xl"
          style={{
            '--coin-left': `${coin.left}px`,
            '--coin-rotate': `${coin.rotate}deg`,
            animationDelay: `${coin.delay}s`,
            animationDuration: `${coin.duration}s`,
          } as CoinStyle}
        >
          🪙
        </span>
      ))}
    </div>
  )
}
