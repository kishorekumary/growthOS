'use client'

import { useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useReward } from '@/contexts/RewardContext'
import { WORKBOOK_POINTS, type Exercise } from '@/lib/workbook'
import { cn } from '@/lib/utils'

const draftKey = (slug: string) => `workbook-draft:${slug}`

function loadDraft(slug: string): string[] {
  try { return JSON.parse(localStorage.getItem(draftKey(slug)) ?? '[]') } catch { return [] }
}

// Steps through one workbook exercise a question at a time. Answers are
// drafted to localStorage (per exercise, not per day — some exercises span
// a few days) and saved to the journal on finish.
export default function ExerciseRunner({ exercise, date, onClose, onSaved }: {
  exercise: Exercise
  date:     string
  onClose:  () => void
  onSaved:  () => void
}) {
  const { questions } = exercise
  const [answers, setAnswers] = useState<string[]>(() => {
    const saved = loadDraft(exercise.slug)
    return questions.map((_, i) => saved[i] ?? '')
  })
  // Resume at the first unanswered question.
  const [step, setStep] = useState(() => {
    const i = answers.findIndex(a => !a.trim())
    return i === -1 ? questions.length - 1 : i
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const { celebrateMilestones } = useReward()

  function setAnswer(value: string) {
    const next = answers.map((a, i) => i === step ? value : a)
    setAnswers(next)
    try { localStorage.setItem(draftKey(exercise.slug), JSON.stringify(next)) } catch {}
  }

  async function finish() {
    if (saving) return
    if (!answers.some(a => a.trim())) { setError('Answer at least one question'); return }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/journal/workbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, slug: exercise.slug, qa: questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' })) }),
    })
    if (res.ok) {
      const { points } = await res.json() as { points: number }
      try { localStorage.removeItem(draftKey(exercise.slug)) } catch {}
      onSaved()
      if (points > 0) celebrateMilestones([{ label: `${exercise.title} done.`, points }])
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not save your answers')
    }
    setSaving(false)
  }

  const isLast = step === questions.length - 1

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {questions.map((_, i) => (
          <span key={i} className={cn(
            'h-1 flex-1 rounded-full',
            i < step ? 'bg-emerald-400/60' : i === step ? 'bg-violet-400' : 'bg-white/10',
          )} />
        ))}
      </div>

      {exercise.intro && step === 0 && <p className="text-xs text-slate-500">{exercise.intro}</p>}

      <div>
        <p className="text-[11px] text-slate-500">{step + 1} of {questions.length}</p>
        <p className="text-base font-medium text-white leading-snug">{questions[step]}</p>
      </div>

      <textarea
        key={`${exercise.slug}-${step}`}
        autoFocus
        value={answers[step] ?? ''}
        onChange={e => setAnswer(e.target.value)}
        rows={4}
        placeholder="Be honest. Nobody else reads this."
        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/60"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step === 0 ? onClose() : setStep(step - 1)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {step === 0 ? 'Later' : 'Back'}
        </button>
        <button
          type="button"
          onClick={() => isLast ? finish() : setStep(step + 1)}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-violet-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {isLast ? `Finish · +${WORKBOOK_POINTS}` : (answers[step] ?? '').trim() ? 'Next' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
