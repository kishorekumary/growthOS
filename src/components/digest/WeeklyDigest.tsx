'use client'

import { useState } from 'react'
import { Sparkles, Trophy, Lightbulb, ArrowRight, RefreshCw, Loader2 } from 'lucide-react'

interface DigestData {
  headline: string
  wins: string[]
  insight: string
  focus_next_week: string[]
  score: number
  score_reason: string
}

function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const pct = score / 10
  const dash = circ * pct
  const color = score >= 8 ? '#22c55e' : score >= 6 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <span className="text-2xl font-bold text-white">{score}</span>
    </div>
  )
}

export default function WeeklyDigest() {
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  async function generate(force = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/weekly-digest', {
        method: 'POST',
        headers: force ? { 'x-force-refresh': '1' } : {},
      })
      if (!res.ok) throw new Error('Failed to generate digest')
      const json = await res.json()
      setDigest(json.digest)
      setCached(json.cached)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!digest) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 p-8 flex flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/25">
          <Sparkles className="h-7 w-7 text-purple-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-white">Generate Your Weekly Digest</p>
          <p className="text-sm text-slate-500 mt-1">AI analyzes your week across fitness, habits, mood, sleep, and more</p>
        </div>
        {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        <button
          onClick={() => generate()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-6 py-2.5 text-sm font-medium text-white transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Analyzing your week…' : 'Generate Digest'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">AI Weekly Digest</span>
              {cached && <span className="text-[10px] text-slate-600 bg-slate-800 rounded px-1.5 py-0.5">cached</span>}
            </div>
            <h2 className="text-lg font-bold text-white leading-snug">{digest.headline}</h2>
            <p className="text-xs text-slate-500 mt-1">{digest.score_reason}</p>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ScoreRing score={digest.score} />
            <span className="text-[10px] text-slate-500">Week Score</span>
          </div>
        </div>
      </div>

      {/* Wins */}
      {digest.wins.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">Wins this week</span>
          </div>
          <ul className="space-y-2">
            {digest.wins.map((win, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                {win}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Insight */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-blue-400">Key insight</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{digest.insight}</p>
      </div>

      {/* Focus next week */}
      {digest.focus_next_week.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">Focus for next week</span>
          </div>
          <ol className="space-y-2">
            {digest.focus_next_week.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">{i + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Refresh */}
      <button
        onClick={() => generate(true)}
        disabled={loading}
        className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        Regenerate digest
      </button>
    </div>
  )
}
