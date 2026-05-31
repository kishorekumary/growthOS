'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Survey data ─────────────────────────────────────────────────────────────

const BUCKETS = [
  {
    key: 'action',
    label: 'Bucket A — Taking Action',
    title: 'The Action Gap',
    subtitle: 'How much does thinking delay your doing?',
    questions: [
      'I know what to do, but I keep waiting before I start.',
      'I am scared of making the wrong choice, so I do nothing.',
      'I stay quiet and hold back my ideas because I am not 100% sure yet.',
    ],
  },
  {
    key: 'mental',
    label: 'Bucket B — Stuck in My Head',
    title: 'The Mental Loop',
    subtitle: 'How often does your mind replay, worry, and catastrophise?',
    questions: [
      'I keep replaying things that already happened, over and over in my mind.',
      'I imagine things going wrong more than I imagine things going right.',
      'I think clearly when I am alone, but my mind goes blank when people are watching.',
    ],
  },
  {
    key: 'execution',
    label: 'Bucket C — Getting Things Done',
    title: 'The Execution Gap',
    subtitle: 'Where does your thinking fail to become results?',
    questions: [
      'I spend too long thinking about small decisions that don\'t really matter.',
      'I put off important things even when I already know what to do.',
      'I think a lot but do not show much of it through my actions.',
      'I know I can do more. But staying consistent is the hard part.',
    ],
  },
]

const SCALE = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'Often' },
  { value: 4, label: 'Always' },
]

// Global question list with bucket index for lookup
const ALL_QUESTIONS = BUCKETS.flatMap((b, bi) =>
  b.questions.map((q, qi) => ({ text: q, bucketIdx: bi, localIdx: qi }))
)
const TOTAL = ALL_QUESTIONS.length // 10

// ─── Scoring ─────────────────────────────────────────────────────────────────

function bucketScore(answers: Record<number, number>, bucketIdx: number) {
  return ALL_QUESTIONS.reduce((sum, q, gi) =>
    q.bucketIdx === bucketIdx ? sum + (answers[gi] ?? 0) : sum, 0)
}

function bucketMax(bucketIdx: number) {
  return BUCKETS[bucketIdx].questions.length * 4
}

function profile(total: number) {
  if (total <= 18) return {
    label: 'Rare Overthinker',
    color: 'bg-emerald-400',
    description: 'Thinking rarely gets in your way. You act decisively, trust your judgment, and move forward with clarity. Your challenge is to keep this sharpness when pressure rises.',
    breakthrough: 'Stay sharp under pressure. Your instincts work well — your next growth edge is maintaining that clarity when the stakes are higher and the noise is louder.',
  }
  if (total <= 26) return {
    label: 'Occasional Overthinker',
    color: 'bg-amber-400',
    description: 'You get things done — but inconsistently. Under normal conditions you execute well. Under pressure, scrutiny, or high stakes, your thinking slows you down. You have the awareness and the capability. What is missing is a reliable system to stay in motion when it matters most.',
    breakthrough: 'Build a decision trigger. You don\'t need to think less – you need a personal rule that forces action when your brain wants to stall. One committed default behaviour changes everything.',
  }
  if (total <= 33) return {
    label: 'Regular Overthinker',
    color: 'bg-orange-400',
    description: 'Overthinking is regularly slowing you down. You are caught in patterns of hesitation, replay, and delayed action. You know you are capable of more — but the gap between thinking and doing keeps widening. Structural change is available to you.',
    breakthrough: 'Break the loop with a time limit. Give yourself a maximum of 5 minutes to decide on anything. When the time is up, you act — even imperfectly. Action creates more information than thinking ever will.',
  }
  return {
    label: 'Deep Overthinker',
    color: 'bg-red-400',
    description: 'Overthinking has become your default mode. It is costing you ideas, time, relationships, and momentum. The good news is that awareness is the first step — and you now have it. The shift requires deliberate, daily practice.',
    breakthrough: 'Your one job this week is to act before you feel ready. Pick one thing you have been overthinking for more than a week. Do the smallest possible version of it today — before your brain can object.',
  }
}

function bucketSummary(score: number, maxScore: number, bucketIdx: number) {
  const pct = score / maxScore
  if (bucketIdx === 0) {
    if (pct < 0.5) return 'Low block. You move from thinking to action without too much friction.'
    if (pct < 0.75) return 'Moderate block. You hesitate sometimes – especially when the stakes feel high.'
    return 'High block. Analysis paralysis is regularly preventing you from starting.'
  }
  if (bucketIdx === 1) {
    if (pct < 0.5) return 'Clear mind. You process events without excessive replay or worry.'
    if (pct < 0.75) return 'Mental loop. You replay and worry more than you should – especially after high-pressure moments.'
    return 'Heavy loop. Your mind rarely stops — replay, worry, and catastrophising are frequent.'
  }
  if (pct < 0.5) return 'Strong execution. You follow through and stay consistent.'
  if (pct < 0.75) return 'Moderate gap. Consistency is the missing variable. You do well in bursts but struggle to maintain momentum.'
  return 'Execution gap. Thinking rarely converts to sustained action and results.'
}

// ─── Component ───────────────────────────────────────────────────────────────

type Answers = Record<number, number>

export default function OverthinkingAuditPage() {
  const [answers, setAnswers] = useState<Answers>({})
  const [showResults, setShowResults] = useState(false)

  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === TOTAL

  function select(globalIdx: number, value: number) {
    setAnswers((prev) => ({ ...prev, [globalIdx]: value }))
  }

  function handleSubmit() {
    if (!allAnswered) return
    setShowResults(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRetake() {
    setAnswers({})
    setShowResults(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (showResults) {
    const total = Object.values(answers).reduce((s, v) => s + v, 0)
    const { label, color, description, breakthrough } = profile(total)

    return (
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
        <p className="text-xs text-slate-600 uppercase tracking-widest text-center mb-6">
          Your Overthinking Audit Result
        </p>

        {/* Score */}
        <div className="text-center mb-8">
          <p className="text-8xl font-bold text-white tracking-tight">{total}</p>
          <p className="text-slate-400 text-sm mt-1">out of 40 points</p>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Your Profile</p>
          <div className="flex items-center gap-2 mb-4">
            <span className={cn('h-3 w-3 rounded-full', color)} />
            <h2 className="text-2xl font-bold text-white">{label}</h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{description}</p>
          <div className="border-l-2 border-amber-500/50 pl-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              <span className="font-semibold text-white">Your breakthrough: </span>
              {breakthrough}
            </p>
          </div>
        </div>

        {/* Where It Hits You */}
        <h3 className="text-xl font-bold text-white mb-5">Where It Hits You</h3>
        <div className="space-y-5 mb-10">
          {BUCKETS.map((bucket, bi) => {
            const score = bucketScore(answers, bi)
            const max = bucketMax(bi)
            const pct = Math.round((score / max) * 100)
            return (
              <div key={bucket.key}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-500 uppercase tracking-widest">{bucket.label}</p>
                  <p className="text-sm font-bold text-white">{score} <span className="text-slate-500 font-normal">/ {max}</span></p>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 mb-2">
                  <div
                    className="h-1.5 rounded-full bg-amber-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-white">{bucketSummary(score, max, bi).split('.')[0]}.</span>
                  {' '}{bucketSummary(score, max, bi).split('.').slice(1).join('.')}
                </p>
              </div>
            )
          })}
        </div>

        {/* Your Answers */}
        <h3 className="text-xl font-bold text-white mb-4">Your Answers</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {ALL_QUESTIONS.map((q, gi) => (
            <div key={gi} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <span className="mt-0.5 text-lg font-bold text-white shrink-0 w-5 text-center">
                {answers[gi]}
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">{q.text}</p>
            </div>
          ))}
        </div>

        {/* 3-Step Action Plan */}
        <div className="rounded-2xl border border-violet-500/20 bg-violet-600/5 p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-5">Your 3-Step Action Plan</h3>
          <ol className="space-y-5">
            {[
              {
                title: 'Create Your Decision Filter',
                body: 'Ask these 3 questions before you start: Is this reversible? What is the cost of not deciding now? What is the minimum viable action? If you can answer all three in 60 seconds – act.',
              },
              {
                title: 'Name Your Stall Pattern',
                body: 'Look at your bucket scores. Where did you score highest – A, B, or C? That is your specific overthinking type. Name it. Own it. Build one habit specifically targeting that bucket.',
              },
              {
                title: 'Weekly Commitment Ritual',
                body: 'Every Monday, write one thing you have been putting off. By Wednesday it must be started. By Friday it must have a result – even an imperfect one. Repetition builds the action reflex.',
              },
            ].map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/30 border border-violet-500/30 text-sm font-bold text-violet-300">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Retake */}
        <button
          onClick={handleRetake}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retake The Audit
        </button>
      </div>
    )
  }

  // ── Survey ────────────────────────────────────────────────────────────────
  let globalIdx = 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      {/* Header */}
      <Link
        href="/focus"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex items-start justify-between mb-10">
        <h1 className="text-3xl font-bold text-white italic">The Overthinking Audit</h1>
        <div className="text-right shrink-0 ml-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">Progress</p>
          <p className="text-sm text-slate-300 font-medium">{answeredCount} / {TOTAL} answered</p>
        </div>
      </div>

      {/* Buckets */}
      {BUCKETS.map((bucket, bi) => {
        const bucketStart = globalIdx
        globalIdx += bucket.questions.length

        return (
          <div key={bucket.key} className="mb-12">
            {/* Bucket header */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              {bucket.label}
            </p>
            <h2 className="text-2xl font-bold text-white mb-1">{bucket.title}</h2>
            <p className="text-sm text-slate-400 italic mb-8">{bucket.subtitle}</p>

            {/* Questions */}
            <div className="space-y-6">
              {bucket.questions.map((qText, qi) => {
                const gi = bucketStart + qi
                const selected = answers[gi]
                return (
                  <div key={qi} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <p className="text-xs text-slate-600 uppercase tracking-widest mb-3">
                      Question {String(gi + 1).padStart(2, '0')} of {TOTAL}
                    </p>
                    <p className="text-base font-medium text-white mb-5 leading-snug">{qText}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {SCALE.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => select(gi, opt.value)}
                          className={cn(
                            'rounded-xl border py-4 flex flex-col items-center gap-1 transition-all',
                            selected === opt.value
                              ? 'border-amber-500/60 bg-amber-500/15 text-white'
                              : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
                          )}
                        >
                          <span className="text-2xl font-bold leading-none">{opt.value}</span>
                          <span className="text-xs">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Submit */}
      <div className="sticky bottom-6">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={cn(
            'w-full rounded-xl py-3.5 text-sm font-semibold transition-all',
            allAnswered
              ? 'bg-amber-500 hover:bg-amber-400 text-black'
              : 'bg-white/5 border border-white/10 text-slate-600 cursor-not-allowed'
          )}
        >
          {allAnswered ? 'See My Results' : `Answer all ${TOTAL - answeredCount} remaining questions`}
        </button>
      </div>
    </div>
  )
}
