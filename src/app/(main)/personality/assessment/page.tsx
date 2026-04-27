'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Check, ArrowLeft } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { QUIZ_QUESTIONS, computeMbti, MBTI_TYPES } from '@/lib/mbti'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Phase = 'quiz' | 'saving' | 'result'

interface AiInsight {
  description: string
  strengths: string[]
  growth: string[]
  habits: string[]
}

export default function AssessmentPage() {
  const router = useRouter()
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [phase, setPhase] = useState<Phase>('quiz')
  const [mbtiType, setMbtiType] = useState('')
  const [insight, setInsight] = useState<AiInsight | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const q = QUIZ_QUESTIONS[current]
  const progress = Math.round(((current + 1) / QUIZ_QUESTIONS.length) * 100)
  const selected = answers[current]
  const allAnswered = Object.keys(answers).length === QUIZ_QUESTIONS.length

  function selectAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [current]: value }))
  }

  function goNext() {
    if (current < QUIZ_QUESTIONS.length - 1) setCurrent((c) => c + 1)
  }

  function goBack() {
    if (current > 0) setCurrent((c) => c - 1)
  }

  async function handleFinish() {
    setPhase('saving')
    const type = computeMbti(answers)
    setMbtiType(type)

    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('personality_assessments').insert({
        user_id: user.id,
        mbti_type: type,
        answers,
        scores: { type },
      })
    }

    setPhase('result')
    setInsightLoading(true)

    try {
      const res = await fetch('/api/ai/personality-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mbtiType: type }),
      })
      const data = await res.json()
      setInsight(data)
    } catch {
      setInsight(null)
    } finally {
      setInsightLoading(false)
    }
  }

  // ── Results screen ────────────────────────────────────────
  if (phase === 'result' || phase === 'saving') {
    const typeData = MBTI_TYPES[mbtiType]
    const displayStrengths = insight?.strengths ?? typeData?.strengths ?? []
    const displayGrowth = insight?.growth ?? typeData?.growth ?? []

    return (
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
        <Link href="/personality" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Personality
        </Link>

        {/* Type hero */}
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-violet-600/5 p-8 text-center mb-6">
          <p className="text-sm text-slate-400 mb-2">Your personality type is</p>
          <h1 className="text-6xl font-bold text-white tracking-tight mb-1">{mbtiType}</h1>
          {typeData && (
            <>
              <p className="text-xl text-violet-300 font-medium">{typeData.name}</p>
              <p className="text-slate-400 text-sm mt-2">{typeData.tagline}</p>
            </>
          )}
        </div>

        {/* AI Description */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-4">
          <h3 className="font-semibold text-white mb-3">About You</h3>
          {insightLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`h-3.5 rounded-full bg-white/10 animate-pulse ${i === 3 ? 'w-2/3' : 'w-full'}`} />
              ))}
            </div>
          ) : insight?.description ? (
            <p className="text-sm text-slate-300 leading-relaxed">{insight.description}</p>
          ) : typeData ? (
            <p className="text-sm text-slate-300 leading-relaxed">{typeData.tagline}.</p>
          ) : null}
        </div>

        {/* Strengths + Growth */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Strengths</h3>
            {insightLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-3 rounded-full bg-white/10 animate-pulse" />)}</div>
            ) : (
              <ul className="space-y-1.5">
                {displayStrengths.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />{s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Growth Areas</h3>
            {insightLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-3 rounded-full bg-white/10 animate-pulse" />)}</div>
            ) : (
              <ul className="space-y-1.5">
                {displayGrowth.map((g) => (
                  <li key={g} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="h-3.5 w-3.5 rounded-full border border-amber-400/50 bg-amber-400/10 mt-0.5 shrink-0 flex items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    </span>
                    {g}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Suggested habits */}
        {(insightLoading || (insight?.habits && insight.habits.length > 0)) && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-6">
            <h3 className="text-sm font-semibold text-white mb-3">Suggested Habits for {mbtiType}</h3>
            {insightLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-3 rounded-full bg-white/10 animate-pulse" />)}</div>
            ) : (
              <ul className="space-y-2">
                {insight!.habits.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400 shrink-0 font-medium">{i + 1}</span>
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Button
          onClick={() => router.push('/personality')}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
        >
          Go to My Personality Hub
        </Button>
      </div>
    )
  }

  // ── Quiz screen ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <Link href="/personality" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Personality Assessment</h1>
        <p className="text-slate-400 text-sm">Question {current + 1} of {QUIZ_QUESTIONS.length}</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="h-1.5 w-full rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>{QUIZ_QUESTIONS[current].dimension.replace('EI','Energy').replace('NS','Perception').replace('TF','Decision').replace('JP','Lifestyle')}</span>
          <span>{progress}%</span>
        </div>
      </div>

      {/* Question */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-5">{q.question}</h2>
        <div className="space-y-3">
          {q.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => selectAnswer(opt.value)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-5 py-4 text-left text-sm font-medium transition-all',
                selected === opt.value
                  ? 'border-violet-500 bg-violet-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
              )}
            >
              <span className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                selected === opt.value ? 'border-violet-400 bg-violet-400' : 'border-slate-600'
              )}>
                {selected === opt.value && <Check className="h-3 w-3 text-white" />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="text-slate-400 hover:text-white hover:bg-white/10"
          onClick={goBack}
          disabled={current === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>

        {current < QUIZ_QUESTIONS.length - 1 ? (
          <Button
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={goNext}
            disabled={!selected}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="bg-violet-600 hover:bg-violet-700 text-white min-w-[140px]"
            onClick={handleFinish}
            disabled={!allAnswered}
          >
            See My Results
          </Button>
        )}
      </div>
    </div>
  )
}
