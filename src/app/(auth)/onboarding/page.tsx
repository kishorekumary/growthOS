'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Check } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ─── Constants ───────────────────────────────────────────────

const TOTAL_STEPS = 5

const COUNTRIES = [
  'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India',
  'Indonesia', 'Italy', 'Japan', 'Mexico', 'Netherlands', 'New Zealand',
  'Nigeria', 'Pakistan', 'Philippines', 'Russia', 'Saudi Arabia',
  'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sweden',
  'Switzerland', 'Turkey', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Other',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD']

const GOALS = [
  { id: 'personality', label: 'Personality Development', emoji: '🧠' },
  { id: 'fitness',     label: 'Fitness & Health',        emoji: '💪' },
  { id: 'finance',     label: 'Finance & Wealth',        emoji: '💰' },
  { id: 'books',       label: 'Books & Learning',        emoji: '📚' },
]

const PERSONALITY_QUESTIONS = [
  {
    question: 'In social situations, you usually feel...',
    options: [{ label: 'Energized', value: 'E' }, { label: 'Drained', value: 'I' }],
  },
  {
    question: 'When making decisions, you rely more on...',
    options: [{ label: 'Logic', value: 'T' }, { label: 'Feelings', value: 'F' }],
  },
  {
    question: 'You prefer to...',
    options: [{ label: 'Plan ahead', value: 'J' }, { label: 'Stay flexible', value: 'P' }],
  },
  {
    question: 'You focus more on...',
    options: [{ label: 'Big picture', value: 'N' }, { label: 'Details', value: 'S' }],
  },
  {
    question: 'Deadlines make you feel...',
    options: [{ label: 'Motivated', value: 'motivated' }, { label: 'Stressed', value: 'stressed' }],
  },
]

// ─── Types ────────────────────────────────────────────────────

interface OnboardingData {
  full_name: string
  age: string
  occupation: string
  country: string
  monthly_income: string
  currency: string
  primary_goals: string[]
  personality: Record<number, string>
  fitness_level: string
  fitness_goal: string
}

// ─── Helpers ─────────────────────────────────────────────────

function deriveMbti(answers: Record<number, string>): string {
  const ei = answers[0] === 'E' ? 'E' : 'I'
  const ns = answers[3] === 'N' ? 'N' : 'S'
  const tf = answers[1] === 'T' ? 'T' : 'F'
  const jp = answers[2] === 'J' ? 'J' : 'P'
  return `${ei}${ns}${tf}${jp}`
}

// ─── Shared sub-components ────────────────────────────────────

function SelectButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all',
        active
          ? 'border-purple-500 bg-purple-500/20 text-white'
          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white',
        className
      )}
    >
      {active && (
        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500">
          <Check className="h-2.5 w-2.5 text-white" />
        </span>
      )}
      {children}
    </button>
  )
}

function NativeSelect({
  value,
  onChange,
  options,
  id,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  id: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-slate-900 text-white">
          {o}
        </option>
      ))}
    </select>
  )
}

// ─── Step components ──────────────────────────────────────────

function Step1({
  data,
  update,
  error,
}: {
  data: OnboardingData
  update: (patch: Partial<OnboardingData>) => void
  error: string | null
}) {
  return (
    <>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl text-white">Tell us about yourself</CardTitle>
        <CardDescription className="text-slate-400">Help us personalise your experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="text-slate-300">Full name</Label>
          <Input
            id="full_name"
            placeholder="Jane Doe"
            value={data.full_name}
            onChange={(e) => update({ full_name: e.target.value })}
            className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="age" className="text-slate-300">Age</Label>
          <Input
            id="age"
            type="number"
            min={10}
            max={120}
            placeholder="28"
            value={data.age}
            onChange={(e) => update({ age: e.target.value })}
            className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="occupation" className="text-slate-300">Occupation</Label>
          <Input
            id="occupation"
            placeholder="Software engineer"
            value={data.occupation}
            onChange={(e) => update({ occupation: e.target.value })}
            className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country" className="text-slate-300">Country</Label>
          <NativeSelect id="country" value={data.country} onChange={(v) => update({ country: v })} options={COUNTRIES} />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </>
  )
}

function Step2({
  data,
  update,
  error,
}: {
  data: OnboardingData
  update: (patch: Partial<OnboardingData>) => void
  error: string | null
}) {
  return (
    <>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl text-white">Your finances</CardTitle>
        <CardDescription className="text-slate-400">This helps us give you income-specific advice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="monthly_income" className="text-slate-300">Monthly income</Label>
          <Input
            id="monthly_income"
            type="number"
            min={0}
            placeholder="5000"
            value={data.monthly_income}
            onChange={(e) => update({ monthly_income: e.target.value })}
            className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-slate-300">Currency</Label>
          <NativeSelect id="currency" value={data.currency} onChange={(v) => update({ currency: v })} options={CURRENCIES} />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </>
  )
}

function Step3({
  data,
  update,
  error,
}: {
  data: OnboardingData
  update: (patch: Partial<OnboardingData>) => void
  error: string | null
}) {
  function toggle(id: string) {
    const goals = data.primary_goals.includes(id)
      ? data.primary_goals.filter((g) => g !== id)
      : [...data.primary_goals, id]
    update({ primary_goals: goals })
  }

  return (
    <>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl text-white">Your goals</CardTitle>
        <CardDescription className="text-slate-400">Choose one or more areas you want to grow in</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {GOALS.map((goal) => (
          <SelectButton
            key={goal.id}
            active={data.primary_goals.includes(goal.id)}
            onClick={() => toggle(goal.id)}
            className="w-full justify-start"
          >
            <span className="text-lg">{goal.emoji}</span>
            <span>{goal.label}</span>
          </SelectButton>
        ))}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </>
  )
}

function Step4({
  data,
  update,
  error,
}: {
  data: OnboardingData
  update: (patch: Partial<OnboardingData>) => void
  error: string | null
}) {
  function answer(questionIndex: number, value: string) {
    update({ personality: { ...data.personality, [questionIndex]: value } })
  }

  return (
    <>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl text-white">Quick personality quiz</CardTitle>
        <CardDescription className="text-slate-400">5 questions to understand how you think</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {PERSONALITY_QUESTIONS.map((q, idx) => (
          <div key={idx} className="space-y-2">
            <p className="text-sm text-slate-300">{q.question}</p>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt) => (
                <SelectButton
                  key={opt.value}
                  active={data.personality[idx] === opt.value}
                  onClick={() => answer(idx, opt.value)}
                >
                  {opt.label}
                </SelectButton>
              ))}
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </>
  )
}

function Step5({
  data,
  update,
  error,
}: {
  data: OnboardingData
  update: (patch: Partial<OnboardingData>) => void
  error: string | null
}) {
  const FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Advanced']
  const FITNESS_GOALS = ['Lose Weight', 'Build Muscle', 'More Energy', 'Stay Active']

  return (
    <>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl text-white">Fitness basics</CardTitle>
        <CardDescription className="text-slate-400">Help us tailor your fitness experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-slate-300">Fitness level</Label>
          <div className="grid grid-cols-3 gap-2">
            {FITNESS_LEVELS.map((level) => (
              <SelectButton
                key={level}
                active={data.fitness_level === level}
                onClick={() => update({ fitness_level: level })}
                className="justify-center"
              >
                {level}
              </SelectButton>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Primary goal</Label>
          <div className="grid grid-cols-2 gap-2">
            {FITNESS_GOALS.map((goal) => (
              <SelectButton
                key={goal}
                active={data.fitness_goal === goal}
                onClick={() => update({ fitness_goal: goal })}
                className="justify-center text-center"
              >
                {goal}
              </SelectButton>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [data, setData] = useState<OnboardingData>({
    full_name: '',
    age: '',
    occupation: '',
    country: 'United States',
    monthly_income: '',
    currency: 'USD',
    primary_goals: [],
    personality: {},
    fitness_level: '',
    fitness_goal: '',
  })

  function update(patch: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...patch }))
    setStepError(null)
  }

  function validate(): string | null {
    switch (step) {
      case 1:
        if (!data.full_name.trim()) return 'Full name is required'
        if (!data.age || Number(data.age) < 10) return 'Please enter a valid age'
        if (!data.occupation.trim()) return 'Occupation is required'
        return null
      case 2:
        if (!data.monthly_income || Number(data.monthly_income) < 0)
          return 'Please enter your monthly income'
        return null
      case 3:
        if (data.primary_goals.length === 0) return 'Please select at least one goal'
        return null
      case 4:
        if (Object.keys(data.personality).length < PERSONALITY_QUESTIONS.length)
          return 'Please answer all questions'
        return null
      case 5:
        if (!data.fitness_level) return 'Please select your fitness level'
        if (!data.fitness_goal) return 'Please select your primary goal'
        return null
      default:
        return null
    }
  }

  function handleNext() {
    const err = validate()
    if (err) { setStepError(err); return }
    setStepError(null)
    setStep((s) => s + 1)
  }

  async function handleFinish() {
    const err = validate()
    if (err) { setStepError(err); return }

    setIsLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const mbti = deriveMbti(data.personality)

    const [profileResult, financeResult, fitnessResult] = await Promise.all([
      supabase.from('user_profiles').upsert({
        id: user.id,
        full_name: data.full_name.trim(),
        age: Number(data.age),
        occupation: data.occupation.trim(),
        country: data.country,
        currency: data.currency,
        primary_goals: data.primary_goals,
        onboarding_done: true,
      }),

      supabase.from('financial_profile').upsert({
        user_id: user.id,
        monthly_income: Number(data.monthly_income),
        monthly_expenses: {},
      }),

      supabase.from('fitness_profile').upsert({
        user_id: user.id,
        fitness_level: data.fitness_level.toLowerCase(),
        primary_goal: data.fitness_goal.toLowerCase().replace(' ', '_'),
      }),
    ])

    const errors = [profileResult.error, financeResult.error, fitnessResult.error].filter(Boolean)

    if (data.primary_goals.includes('books')) {
      await supabase.from('book_preferences').upsert({ user_id: user.id, genres: [] })
    }

    await supabase.from('personality_assessments').insert({
      user_id: user.id,
      mbti_type: mbti,
      answers: data.personality,
      scores: { mbti },
    })

    if (errors.length > 0) {
      setStepError('Something went wrong saving your data. Please try again.')
      setIsLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const progress = Math.round((step / TOTAL_STEPS) * 100)

  const stepLabels = ['About you', 'Finances', 'Goals', 'Personality', 'Fitness']

  return (
    <div className="w-full space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step card */}
      <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
        {step === 1 && <Step1 data={data} update={update} error={stepError} />}
        {step === 2 && <Step2 data={data} update={update} error={stepError} />}
        {step === 3 && <Step3 data={data} update={update} error={stepError} />}
        {step === 4 && <Step4 data={data} update={update} error={stepError} />}
        {step === 5 && <Step5 data={data} update={update} error={stepError} />}

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-6">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-white/10"
              onClick={() => { setStepError(null); setStep((s) => s - 1) }}
              disabled={isLoading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleNext}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 text-white min-w-[100px]"
              onClick={handleFinish}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Finish'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
