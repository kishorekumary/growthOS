'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, AlertCircle, Dumbbell, Wallet, BookOpen, Sparkles, Briefcase, CheckSquare } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type GoalCategory = 'fitness' | 'finance' | 'books' | 'general' | 'career'

const GOAL_CATEGORIES: { value: GoalCategory; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'fitness', label: 'Fitness', icon: Dumbbell,   color: 'text-emerald-400' },
  { value: 'finance', label: 'Finance', icon: Wallet,     color: 'text-sky-400' },
  { value: 'books',   label: 'Books',   icon: BookOpen,   color: 'text-amber-400' },
  { value: 'general', label: 'General', icon: Sparkles,   color: 'text-violet-400' },
  { value: 'career',  label: 'Career',  icon: Briefcase,  color: 'text-rose-400' },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
        checked ? 'bg-violet-600' : 'bg-white/10'
      )}
    >
      <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  )
}

export default function BriefingSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [goalCategories, setGoalCategories] = useState<GoalCategory[]>(['fitness', 'finance', 'books', 'general', 'career'])
  const [showTasks, setShowTasks]           = useState(true)

  const loadSettings = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data } = await supabase
      .from('briefing_settings')
      .select('goal_categories, show_tasks')
      .maybeSingle()

    if (data) {
      setGoalCategories((data.goal_categories as GoalCategory[] | null) ?? [])
      setShowTasks(data.show_tasks ?? true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  function toggleCategory(cat: GoalCategory) {
    setGoalCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setError('Not signed in.'); return }

    const { error: err } = await supabase.from('briefing_settings').upsert(
      {
        user_id:         user.id,
        goal_categories: goalCategories,
        show_tasks:      showTasks,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (err) {
      setError('Failed to save settings.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <p className="text-sm text-emerald-300">Settings saved</p>
        </div>
      )}

      {/* Goal categories */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Goal Categories</p>
          <p className="text-xs text-slate-500 mt-0.5">Only show goals from these categories in the popup</p>
        </div>
        <div className="space-y-1">
          {GOAL_CATEGORIES.map(({ value, label, icon: Icon, color }) => (
            <div key={value} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2.5">
                <Icon className={cn('h-4 w-4', color)} />
                <span className="text-sm text-slate-200">{label}</span>
              </div>
              <Toggle checked={goalCategories.includes(value)} onChange={() => toggleCategory(value)} />
            </div>
          ))}
        </div>
      </div>

      {/* Tasks section toggle */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20">
              <CheckSquare className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Today&apos;s Tasks</p>
              <p className="text-xs text-slate-500 mt-0.5">Show pending tasks in the popup</p>
            </div>
          </div>
          <Toggle checked={showTasks} onChange={() => setShowTasks(v => !v)} />
        </div>
      </div>

      <Button
        onClick={saveSettings}
        disabled={saving}
        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
      >
        {saving
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          : 'Save Briefing Settings'}
      </Button>
    </div>
  )
}
