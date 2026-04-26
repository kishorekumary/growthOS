'use client'

import { useState, useEffect } from 'react'
import { Loader2, Trophy, BookOpen, ChevronUp, ChevronDown } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Challenge {
  id: string
  challenge_month: string
  book_title: string
  author: string | null
  genre: string | null
  total_chapters: number
  chapters_read: number
  ai_note: string | null
}

const COMMUNITY_NOTES = [
  'Readers around the world are exploring this title together. Every chapter counts! 🌍',
  'Join thousands of curious minds on this reading journey. You\'ve got this! 📚',
  'This month\'s pick is sparking great conversations. Dive in! ✨',
  'Reading is one of the highest-ROI habits. Enjoy every page! 🚀',
]

export default function BookChallenge() {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading]     = useState(true)
  const [starting, setStarting]   = useState(false)
  const [updating, setUpdating]   = useState(false)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    async function fetchChallenge() {
      const monthStart = format(new Date(), 'yyyy-MM-01')
      const { data } = await supabase
        .from('book_challenges')
        .select('*')
        .eq('challenge_month', monthStart)
        .maybeSingle()
      setChallenge(data as Challenge ?? null)
      setLoading(false)
    }
    fetchChallenge()
  }, [])

  async function startChallenge() {
    setStarting(true)
    const res = await fetch('/api/ai/book-challenge', { method: 'POST' })
    const data = await res.json()
    if (data.challenge) setChallenge(data.challenge)
    setStarting(false)
  }

  async function updateChapters(delta: number) {
    if (!challenge) return
    const next = Math.max(0, Math.min(challenge.total_chapters, challenge.chapters_read + delta))
    if (next === challenge.chapters_read) return
    setUpdating(true)
    await supabase
      .from('book_challenges')
      .update({ chapters_read: next, updated_at: new Date().toISOString() })
      .eq('id', challenge.id)
    setChallenge(prev => prev ? { ...prev, chapters_read: next } : prev)
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const monthLabel = format(new Date(), 'MMMM yyyy')
  const communityNote = COMMUNITY_NOTES[new Date().getMonth() % COMMUNITY_NOTES.length]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          Monthly Reading Challenge
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">{monthLabel}</p>
      </div>

      {!challenge ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
            <BookOpen className="h-10 w-10 text-amber-400/30 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No challenge for this month yet.</p>
            <p className="text-slate-600 text-xs mt-1">
              Let AI pick the perfect book for {monthLabel}.
            </p>
          </div>
          <Button
            onClick={startChallenge}
            disabled={starting}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2"
          >
            {starting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Picking your book...</>
              : <><Trophy className="h-4 w-4" /> Start This Month's Challenge</>
            }
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Book card */}
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5 space-y-4">
            <div className="flex items-start gap-4">
              {/* Cover */}
              <div className="h-20 w-14 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6 text-white/70" />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                    📅 {monthLabel}
                  </span>
                  {challenge.genre && (
                    <span className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                      {challenge.genre}
                    </span>
                  )}
                </div>
                <p className="text-base font-semibold text-white leading-snug">{challenge.book_title}</p>
                {challenge.author && (
                  <p className="text-sm text-slate-400">by {challenge.author}</p>
                )}
              </div>
            </div>

            {challenge.ai_note && (
              <p className="text-sm text-amber-200/80 italic leading-relaxed">
                ✨ {challenge.ai_note}
              </p>
            )}
          </div>

          {/* Progress */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Your Progress</p>
              <p className="text-sm font-semibold text-amber-400">
                {challenge.chapters_read} / {challenge.total_chapters} chapters
              </p>
            </div>

            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  challenge.chapters_read >= challenge.total_chapters
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                )}
                style={{ width: `${Math.round((challenge.chapters_read / challenge.total_chapters) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {challenge.chapters_read >= challenge.total_chapters
                  ? '🎉 Challenge complete!'
                  : `${challenge.total_chapters - challenge.chapters_read} chapters remaining`
                }
              </p>
              <p className="text-xs font-medium text-white">
                {Math.round((challenge.chapters_read / challenge.total_chapters) * 100)}%
              </p>
            </div>

            {/* Chapter controls */}
            {challenge.chapters_read < challenge.total_chapters && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => updateChapters(-1)}
                  disabled={updating || challenge.chapters_read === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <div className="flex-1 text-center text-xs text-slate-500">Update chapters</div>
                <button
                  type="button"
                  onClick={() => updateChapters(1)}
                  disabled={updating}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Community note */}
          <div className="rounded-xl border border-white/5 bg-white/3 px-4 py-3">
            <p className="text-xs text-slate-500 leading-relaxed">💬 {communityNote}</p>
          </div>
        </div>
      )}
    </div>
  )
}
