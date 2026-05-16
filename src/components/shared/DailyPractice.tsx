'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Save, X, Plus, Trash2, Loader2, Sparkles, Heart, ScrollText } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Practice {
  pledge: string
  affirmations: string[]
  gratitude: string[]
}

type Tab = 'pledge' | 'affirmations' | 'gratitude'

const EMPTY: Practice = { pledge: '', affirmations: [], gratitude: [] }

const TABS: { id: Tab; label: string; icon: typeof ScrollText; accent: string; ring: string }[] = [
  { id: 'pledge',       label: 'Pledge',       icon: ScrollText, accent: 'text-amber-400',   ring: 'ring-amber-500'   },
  { id: 'affirmations', label: 'Affirmations',  icon: Sparkles,   accent: 'text-violet-400',  ring: 'ring-violet-500'  },
  { id: 'gratitude',    label: 'Gratitude',     icon: Heart,      accent: 'text-emerald-400', ring: 'ring-emerald-500' },
]

// ─── List editor (used inside edit mode) ─────────────────────

function ListEditor({
  items,
  onChange,
  placeholder,
  accentClass,
  ringClass,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  accentClass: string
  ringClass: string
}) {
  function update(i: number, val: string) {
    onChange(items.map((x, idx) => (idx === i ? val : x)))
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            placeholder={placeholder}
            onChange={e => update(i, e.target.value)}
            className={cn(
              'flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white',
              'placeholder:text-slate-600 focus:outline-none focus:ring-1',
              ringClass,
            )}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className={cn('flex items-center gap-1.5 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity', accentClass)}
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function DailyPractice() {
  const [practice, setPractice] = useState<Practice | null>(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState<Practice>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('pledge')

  const fetchPractice = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setLoading(false); return }
    const { data } = await supabase
      .from('daily_practice')
      .select('pledge, affirmations, gratitude')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (data) {
      setPractice({
        pledge:       data.pledge       ?? '',
        affirmations: data.affirmations ?? [],
        gratitude:    data.gratitude    ?? [],
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPractice() }, [fetchPractice])

  function openEdit() {
    setDraft(practice ?? EMPTY)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    const clean: Practice = {
      pledge:       draft.pledge.trim(),
      affirmations: draft.affirmations.map(a => a.trim()).filter(Boolean),
      gratitude:    draft.gratitude.map(g => g.trim()).filter(Boolean),
    }
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSaving(false); return }
    await supabase.from('daily_practice').upsert(
      { user_id: session.user.id, ...clean, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setPractice(clean)
    setSaving(false)
    setEditing(false)
  }

  const hasContent = practice && (
    practice.pledge || practice.affirmations.length > 0 || practice.gratitude.length > 0
  )

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────
  if (!hasContent && !editing) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 p-7 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 mb-1">
          <ScrollText className="h-5 w-5 text-amber-400/60" />
          <Sparkles className="h-5 w-5 text-violet-400/60" />
          <Heart className="h-5 w-5 text-emerald-400/60" />
        </div>
        <p className="text-white font-semibold">Daily Practice</p>
        <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
          Set your personal pledge, affirmations, and gratitude — words that ground and inspire you every day.
        </p>
        <Button onClick={openEdit} className="bg-violet-600 hover:bg-violet-700 text-white mt-1">
          <Plus className="mr-2 h-4 w-4" /> Set Up Daily Practice
        </Button>
      </div>
    )
  }

  const currentTab = TABS.find(t => t.id === activeTab)!

  // ── Shared tab bar ──────────────────────────────────────────
  const tabBar = (
    <div className="flex gap-1 rounded-lg bg-white/5 p-1">
      {TABS.map(t => {
        const Icon = t.icon
        const active = activeTab === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all',
              active ? cn('bg-slate-800 shadow-sm', t.accent) : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        )
      })}
    </div>
  )

  // ── Edit mode ───────────────────────────────────────────────
  if (editing) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Edit Daily Practice</span>
          <button type="button" onClick={cancelEdit} className="text-slate-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {tabBar}

        {/* Tab content */}
        <div className="min-h-[120px]">
          {activeTab === 'pledge' && (
            <textarea
              value={draft.pledge}
              onChange={e => setDraft(d => ({ ...d, pledge: e.target.value }))}
              placeholder="Write your personal pledge — your commitment to yourself..."
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          )}

          {activeTab === 'affirmations' && (
            <ListEditor
              items={draft.affirmations}
              onChange={items => setDraft(d => ({ ...d, affirmations: items }))}
              placeholder="I am confident and capable..."
              accentClass="text-violet-400"
              ringClass="focus:ring-violet-500"
            />
          )}

          {activeTab === 'gratitude' && (
            <ListEditor
              items={draft.gratitude}
              onChange={items => setDraft(d => ({ ...d, gratitude: items }))}
              placeholder="I am grateful for..."
              accentClass="text-emerald-400"
              ringClass="focus:ring-emerald-500"
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={save} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white flex-1">
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              : <><Save className="mr-2 h-4 w-4" /> Save</>}
          </Button>
          <Button
            variant="outline"
            onClick={cancelEdit}
            disabled={saving}
            className="border-white/20 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ── Read mode ───────────────────────────────────────────────
  const TabIcon = currentTab.icon
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Daily Practice</span>
        <button
          type="button"
          onClick={openEdit}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>

      {tabBar}

      {/* Tab content */}
      <div className="min-h-[80px]">
        {activeTab === 'pledge' && (
          practice!.pledge
            ? <blockquote className="text-sm text-amber-100/90 leading-relaxed italic border-l-2 border-amber-500/40 pl-4 whitespace-pre-wrap">
                {practice!.pledge}
              </blockquote>
            : <p className="text-xs text-slate-600 pt-1">No pledge set — click Edit to add one.</p>
        )}

        {activeTab === 'affirmations' && (
          practice!.affirmations.length > 0
            ? <ul className="space-y-2.5">
                {practice!.affirmations.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-violet-500/30 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-violet-300">{i + 1}</span>
                    </span>
                    <span className="text-sm text-white leading-relaxed">{a}</span>
                  </li>
                ))}
              </ul>
            : <p className="text-xs text-slate-600 pt-1">No affirmations set — click Edit to add some.</p>
        )}

        {activeTab === 'gratitude' && (
          practice!.gratitude.length > 0
            ? <ul className="space-y-2.5">
                {practice!.gratitude.map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Heart className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400/60" />
                    <span className="text-sm text-slate-200 leading-relaxed">{g}</span>
                  </li>
                ))}
              </ul>
            : <p className="text-xs text-slate-600 pt-1">No gratitude entries — click Edit to add some.</p>
        )}
      </div>

      {/* Subtle tab label */}
      <p className={cn('text-[11px] flex items-center gap-1', currentTab.accent, 'opacity-50')}>
        <TabIcon className="h-3 w-3" />
        {activeTab === 'pledge'       && 'Your personal commitment'}
        {activeTab === 'affirmations' && `${practice!.affirmations.length} affirmation${practice!.affirmations.length !== 1 ? 's' : ''}`}
        {activeTab === 'gratitude'    && `${practice!.gratitude.length} gratitude entr${practice!.gratitude.length !== 1 ? 'ies' : 'y'}`}
      </p>
    </div>
  )
}
