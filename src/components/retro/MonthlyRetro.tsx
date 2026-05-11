'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Trophy, TrendingUp, TrendingDown, Lightbulb, CheckCircle2, ArrowRight, RefreshCw, Loader2, Star } from 'lucide-react'
import { format, subMonths } from 'date-fns'

interface RetroData {
  headline: string
  highlights: string[]
  growth_areas: string[]
  key_pattern: string
  what_worked: string[]
  what_to_change: string[]
  commitments_next_month: string[]
  score: number
  score_reason: string
}

function ScoreDisplay({ score }: { score: number }) {
  const color = score >= 8 ? 'text-emerald-400' : score >= 6 ? 'text-amber-400' : 'text-red-400'
  const bg    = score >= 8 ? 'bg-emerald-500/10 border-emerald-500/20' : score >= 6 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20'
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border ${bg} px-5 py-4 shrink-0`}>
      <span className={`text-4xl font-black ${color}`}>{score}</span>
      <span className="text-[10px] text-slate-500 mt-0.5">/10 month</span>
    </div>
  )
}

export default function MonthlyRetro() {
  const [retro, setRetro] = useState<RetroData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [month, setMonth] = useState('')

  const prevMonthLabel = format(subMonths(new Date(), 1), 'MMMM yyyy')

  useEffect(() => { generate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(force = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/monthly-retro', {
        method: 'POST',
        headers: force ? { 'x-force-refresh': '1' } : {},
      })
      if (!res.ok) throw new Error('Failed to generate retrospective')
      const json = await res.json()
      setRetro(json.retro)
      setCached(json.cached)
      setMonth(json.month ?? prevMonthLabel)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!retro) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 p-8 flex flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/25">
          {loading ? <Loader2 className="h-7 w-7 text-rose-400 animate-spin" /> : <Sparkles className="h-7 w-7 text-rose-400" />}
        </div>
        <div>
          <p className="text-base font-semibold text-white">
            {loading ? `Loading ${prevMonthLabel} Retrospective…` : `Generate ${prevMonthLabel} Retrospective`}
          </p>
          {!loading && (
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              Deep AI analysis of your full month — patterns, wins, growth areas, and commitments for next month
            </p>
          )}
        </div>
        {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 w-full">{error}</p>}
        {!loading && (
          <button
            onClick={() => generate()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-6 py-2.5 text-sm font-medium text-white transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Generate Retrospective
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-rose-400" />
              <span className="text-xs font-medium text-rose-400 uppercase tracking-wide">{month} Retrospective</span>
              {cached && <span className="text-[10px] text-slate-600 bg-slate-800 rounded px-1.5 py-0.5">cached</span>}
            </div>
            <h2 className="text-lg font-bold text-white leading-snug mb-1">{retro.headline}</h2>
            <p className="text-xs text-slate-500">{retro.score_reason}</p>
          </div>
          <ScoreDisplay score={retro.score} />
        </div>
      </div>

      {/* Two-column: what worked + growth areas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {retro.highlights.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">Highlights</span>
            </div>
            <ul className="space-y-2">
              {retro.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {retro.growth_areas.length > 0 && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-400">Growth areas</span>
            </div>
            <ul className="space-y-2">
              {retro.growth_areas.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Key pattern */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-blue-400">Key pattern this month</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{retro.key_pattern}</p>
      </div>

      {/* What worked / what to change */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {retro.what_worked.length > 0 && (
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-semibold text-purple-400">What worked</span>
            </div>
            <ul className="space-y-2">
              {retro.what_worked.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {retro.what_to_change.length > 0 && (
          <div className="rounded-2xl border border-slate-500/20 bg-slate-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-400">What to change</span>
            </div>
            <ul className="space-y-2">
              {retro.what_to_change.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Commitments for next month */}
      {retro.commitments_next_month.length > 0 && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-rose-400" />
            <span className="text-sm font-semibold text-rose-400">Commitments for next month</span>
          </div>
          <ol className="space-y-2.5">
            {retro.commitments_next_month.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-bold text-rose-400">{i + 1}</span>
                {c}
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
        Regenerate retrospective
      </button>
    </div>
  )
}
