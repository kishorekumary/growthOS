'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Survey data ────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    key: 'notifications',
    label: 'Notifications',
    title: 'Section 1 – Notifications and Digital Interruptions',
    questions: [
      {
        text: 'Q1. How many times per hour do notifications interrupt you across all devices?',
        hint: 'Count phone, laptop, smartwatch and all apps combined.',
        options: ['0 to 2 (rare)', '3 to 5 (moderate)', '6 to 10 (frequent)', '10 or more (constant)'],
      },
      {
        text: 'Q2. When a notification arrives, how often do you check it immediately even mid-task?',
        options: ['Almost never', 'Sometimes', 'Usually', 'Almost always'],
      },
      {
        text: 'Q3. How long after waking do you check your phone in the morning?',
        options: ['60 or more minutes', '30 to 60 minutes', 'Under 30 minutes', 'First thing I do'],
      },
      {
        text: 'Q4. How often do you feel pulled to check your phone even when it has not made a sound?',
        hint: 'The phantom notification feeling.',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost constantly'],
      },
    ],
    reflectionQuestions: [
      'What would it feel like to check notifications only twice per day?',
      'When did you last work for 90 minutes without checking your phone?',
      'What would it cost you if you truly turned off all notifications for one day?',
    ],
  },
  {
    key: 'multitasking',
    label: 'Multitasking',
    title: 'Section 2 – Multitasking and Task Switching',
    questions: [
      {
        text: 'Q5. How many browser tabs or apps do you typically have open during work?',
        options: ['1 to 3 (focused)', '4 to 6 (moderate)', '7 to 12 (scattered)', '12 or more (overloaded)'],
      },
      {
        text: 'Q6. How often do you switch tasks before fully completing the current one?',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost always'],
      },
      {
        text: 'Q7. During meetings, how often are you also replying to messages or doing other work?',
        options: ['Never', 'Occasionally', 'Frequently', 'Most meetings'],
      },
      {
        text: 'Q8. How long can you stay on a single task without wanting to switch to something else?',
        options: ['60 or more minutes', '30 to 60 minutes', '10 to 30 minutes', 'Under 10 minutes'],
      },
    ],
    reflectionQuestions: [
      'What would it feel like to close every tab and work on one thing until it is done?',
      'When did you last complete a full 60-minute block on a single task?',
      'What is the real cost of switching – not in time, but in mental depth lost?',
    ],
  },
  {
    key: 'rumination',
    label: 'Rumination',
    title: 'Section 3 – Emotional Rumination',
    questions: [
      {
        text: 'Q9. How often do you replay conversations in your head after they happen?',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost daily'],
      },
      {
        text: 'Q10. When something goes wrong at work, how long does it stay active in your mind?',
        options: ['I move on quickly', 'A few hours', 'Rest of the day', 'Days or longer'],
      },
      {
        text: 'Q11. How often do you worry about or rehearse future conversations before they happen?',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost constantly'],
      },
      {
        text: 'Q12. Do you find it hard to be fully present with others because your mind is elsewhere?',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost always'],
      },
    ],
    reflectionQuestions: [
      'What conversation are you replaying right now that does not need replaying?',
      'When did a worry you rehearsed actually happen exactly as you imagined?',
      'What would you do with the energy you spend on past and future conversations?',
    ],
  },
  {
    key: 'openLoops',
    label: 'Open loops',
    title: 'Section 4 – Unfinished Tasks and Open Loops',
    questions: [
      {
        text: 'Q13. How many unfinished tasks or pending decisions are floating in your mind right now?',
        options: ['0 to 3 (clear)', '4 to 7 (some load)', '8 to 15 (heavy)', '15 or more (overwhelming)'],
      },
      {
        text: 'Q14. How often do undone tasks surface during unrelated activities like meals or exercise?',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost always'],
      },
      {
        text: 'Q15. When you lie down to sleep, how often do unfinished tasks or worries appear?',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost every night'],
      },
      {
        text: 'Q16. How often do you start something, get interrupted, and forget to return to it?',
        options: ['Rarely', 'Sometimes', 'Often', 'Very frequently'],
      },
    ],
    reflectionQuestions: [
      'What is one open loop you could close or consciously park today?',
      'When did an undone task last prevent you from enjoying time off?',
      'What would change if your mind trusted a system to hold your tasks?',
    ],
  },
  {
    key: 'innerNoise',
    label: 'Inner noise',
    title: 'Section 5 – Internal Noise and Mental Chatter',
    questions: [
      {
        text: 'Q17. How often is there a running self-critical voice in the background of your day?',
        hint: 'For example: I should be doing more, that was stupid, I am falling behind.',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost constantly'],
      },
      {
        text: 'Q18. How much energy do you spend comparing yourself to others or questioning if you are enough?',
        options: ['Very little', 'Some', 'Quite a bit', 'A great deal'],
      },
      {
        text: 'Q19. When you have a quiet moment with nothing to do, what happens in your mind?',
        options: ['It settles and rests', 'Some thoughts arise', 'Gets busy quickly', 'Immediately anxious'],
      },
      {
        text: 'Q20. How often do you feel mentally tired even after a full night of sleep?',
        options: ['Rarely', 'Sometimes', 'Often', 'Almost every morning'],
      },
    ],
    reflectionQuestions: [
      'When is the last time you sat quietly and let your mind settle?',
      'What is the loudest thought in your internal critic\'s voice right now?',
      'What would silence feel like if you stopped narrating and judging your day?',
    ],
  },
]

// ─── Types ──────────────────────────────────────────────────────────────────

// answers[sectionIdx][questionIdx] = optionIdx (0–3) | undefined
type Answers = Record<number, Record<number, number>>

function computeScores(answers: Answers) {
  return SECTIONS.map((_, si) => {
    const sectionAnswers = answers[si] ?? {}
    return Object.values(sectionAnswers).reduce((sum, v) => sum + v, 0)
  })
}

function leakageLevel(pct: number) {
  if (pct <= 33) return { label: 'Low leakage', description: 'Your mind is operating with strong clarity. Small refinements can still compound.' }
  if (pct <= 66) return { label: 'Moderate leakage', description: 'You are operating below your true capacity. Real gains are available with targeted changes. Your attention leaks are costing you daily but you are not far from a significantly clearer mental state.' }
  return { label: 'High leakage', description: 'Significant mental bandwidth is being consumed daily. Focused changes in your top categories will free up substantial cognitive capacity.' }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MindshiftSurveyPage() {
  const [sectionIdx, setSectionIdx] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [showResults, setShowResults] = useState(false)
  const [validationError, setValidationError] = useState(false)

  const totalAnswered = Object.values(answers).reduce(
    (sum, section) => sum + Object.keys(section).length,
    0
  )

  const currentSection = SECTIONS[sectionIdx]
  const sectionAnswers = answers[sectionIdx] ?? {}
  const sectionAnsweredCount = Object.keys(sectionAnswers).length
  const sectionComplete = sectionAnsweredCount === 4

  function select(questionIdx: number, optionIdx: number) {
    setValidationError(false)
    setAnswers((prev) => ({
      ...prev,
      [sectionIdx]: { ...(prev[sectionIdx] ?? {}), [questionIdx]: optionIdx },
    }))
  }

  function handleNext() {
    if (!sectionComplete) {
      setValidationError(true)
      return
    }
    setValidationError(false)
    if (sectionIdx < SECTIONS.length - 1) {
      setSectionIdx((i) => i + 1)
    } else {
      setShowResults(true)
    }
  }

  function handleBack() {
    setValidationError(false)
    if (sectionIdx > 0) setSectionIdx((i) => i - 1)
  }

  function handleRestart() {
    setAnswers({})
    setSectionIdx(0)
    setShowResults(false)
    setValidationError(false)
  }

  // ── Results ──────────────────────────────────────────────────────────────
  if (showResults) {
    const scores = computeScores(answers)
    const total = scores.reduce((s, v) => s + v, 0)
    const pct = Math.round((total / 60) * 100)
    const { label, description } = leakageLevel(pct)

    const biggestLeakIdx = scores.indexOf(Math.max(...scores))
    const biggestSection = SECTIONS[biggestLeakIdx]
    const biggestScore = scores[biggestLeakIdx]

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        {/* Top progress bar */}
        <div className="mb-1">
          <div className="h-0.5 w-full bg-blue-500" />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mb-8">
          <span>Section 5 of 5</span>
          <span>20 / 20 answered</span>
        </div>

        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your Results</p>
        <h1 className="text-2xl font-bold text-white mb-6">Your Attention Leakage Profile</h1>

        {/* Category score cards */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          {SECTIONS.map((section, i) => (
            <div
              key={section.key}
              className={cn(
                'rounded-xl border p-4 text-center',
                i === biggestLeakIdx
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-white/10 bg-white/5'
              )}
            >
              <p className="text-xs text-slate-400 mb-2 leading-tight">{section.label}</p>
              <p className="text-3xl font-bold text-white">{scores[i]}</p>
              <p className="text-xs text-slate-500">/ 12</p>
            </div>
          ))}
        </div>

        {/* Total score */}
        <div className="mb-2 flex items-baseline gap-3">
          <span className="text-5xl font-bold text-white">{total}</span>
          <span className="text-slate-400 text-sm">out of 60</span>
        </div>
        <p className="text-slate-400 text-sm mb-4">{pct}% leakage score</p>

        {/* Leakage bar */}
        <div className="mb-1">
          <div className="relative h-2 w-full rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-0.5 bg-white rounded-full"
              style={{ left: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-600 mb-6">
          <span>Low leakage</span>
          <span>High leakage</span>
        </div>

        {/* Level label */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-6">
          <p className="text-sm font-semibold text-amber-400 mb-1">{label} – {description.split('.')[0]}.</p>
          <p className="text-sm text-slate-300 leading-relaxed">{description.split('. ').slice(1).join('. ')}</p>
        </div>

        {/* Biggest leak */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your Biggest Leak</p>
          <p className="text-lg font-bold text-white mb-4">
            {biggestSection.label} – {biggestScore} out of 12
          </p>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Reflection Questions</p>
          <ul className="space-y-2">
            {biggestSection.reflectionQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {q}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Start again
          </button>
          <button
            onClick={() => {}}
            className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm text-white font-medium transition-colors"
          >
            <Zap className="h-4 w-4" />
            Get my action plan
          </button>
        </div>
      </div>
    )
  }

  // ── Survey ────────────────────────────────────────────────────────────────
  const progressPct = Math.round(((sectionIdx + (sectionComplete ? 1 : sectionAnsweredCount / 4)) / SECTIONS.length) * 100)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      {/* Back link */}
      <Link
        href="/focus"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Top progress bar */}
      <div className="mb-1">
        <div className="relative h-0.5 w-full bg-white/10">
          <div
            className="h-0.5 bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-500 mb-8">
        <span>Section {sectionIdx + 1} of {SECTIONS.length}</span>
        <span>{totalAnswered} / 20 answered</span>
      </div>

      {/* Section title */}
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6">
        {currentSection.title}
      </p>

      {/* Questions */}
      <div className="space-y-px">
        {currentSection.questions.map((question, qi) => {
          const selectedOpt = sectionAnswers[qi]
          return (
            <div key={qi} className="border-b border-white/[0.06] py-6 first:pt-0 last:border-b-0">
              <p className="text-sm font-semibold text-white mb-1">{question.text}</p>
              {question.hint && (
                <p className="text-xs text-slate-500 mb-3">{question.hint}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {question.options.map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => select(qi, oi)}
                    className={cn(
                      'rounded-full border px-4 py-1.5 text-sm transition-all',
                      selectedOpt === oi
                        ? 'border-violet-500 bg-violet-500/20 text-white'
                        : 'border-white/[0.12] bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-slate-200'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          type="button"
          onClick={handleBack}
          disabled={sectionIdx === 0}
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>

        <div className="flex items-center gap-4">
          {validationError && (
            <p className="text-xs text-amber-400">Answer all 4 questions to continue</p>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 px-6 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {sectionIdx === SECTIONS.length - 1 ? 'See my results' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
