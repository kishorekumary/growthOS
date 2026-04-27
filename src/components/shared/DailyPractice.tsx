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

const EMPTY: Practice = { pledge: '', affirmations: [], gratitude: [] }

// ─── Read-only display ────────────────────────────────────────

function PledgeCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400/80 mb-3">
        <ScrollText className="h-3.5 w-3.5" /> My Pledge
      </p>
      <blockquote className="text-sm text-amber-100/90 leading-relaxed italic border-l-2 border-amber-500/40 pl-4">
        {text}
      </blockquote>
    </div>
  )
}

function AffirmationsCard({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-400/80 mb-3">
        <Sparkles className="h-3.5 w-3.5" /> Affirmations
      </p>
      <ul className="space-y-2.5">
        {items.map((a, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-violet-500/30 flex items-center justify-center">
              <span className="text-[9px] font-bold text-violet-300">{i + 1}</span>
            </span>
            <span className="text-sm font-medium text-white leading-relaxed">{a}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GratitudeCard({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-400/80 mb-3">
        <Heart className="h-3.5 w-3.5" /> Gratitude
      </p>
      <ul className="space-y-2.5">
        {items.map((g, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Heart className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400/60" />
            <span className="text-sm text-slate-200 leading-relaxed">{g}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Edit form helpers ────────────────────────────────────────

function ListEditor({
  label,
  icon: Icon,
  items,
  onChange,
  placeholder,
  accentClass,
}: {
  label: string
  icon: typeof Plus
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  accentClass: string
}) {
  function update(i: number, val: string) {
    onChange(items.map((x, idx) => idx === i ? val : x))
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...items, ''])
  }

  return (
    <div className="space-y-2">
      <p className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider', accentClass)}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            placeholder={placeholder}
            onChange={e => update(i, e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
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
        onClick={add}
        className={cn('flex items-center gap-1.5 text-xs font-medium transition-colors', accentClass, 'opacity-70 hover:opacity-100')}
      >
        <Plus className="h-3.5 w-3.5" /> Add {label.toLowerCase().replace(/s$/, '')}
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
        pledge:       data.pledge ?? '',
        affirmations: data.affirmations ?? [],
        gratitude:    data.gratitude ?? [],
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
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  // ── Edit mode ───────────────────────────────────────────────
  if (editing) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-slate-900/50 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Edit Daily Practice</p>
          <button
            type="button"
            onClick={cancelEdit}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Pledge */}
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400/80">
            <ScrollText className="h-3.5 w-3.5" /> My Pledge
          </p>
          <textarea
            value={draft.pledge}
            onChange={e => setDraft(d => ({ ...d, pledge: e.target.value }))}
            placeholder="Write your personal pledge — your commitment to yourself..."
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Affirmations */}
        <ListEditor
          label="Affirmations"
          icon={Sparkles}
          items={draft.affirmations}
          onChange={items => setDraft(d => ({ ...d, affirmations: items }))}
          placeholder="I am..."
          accentClass="text-violet-400"
        />

        {/* Gratitude */}
        <ListEditor
          label="Gratitude"
          icon={Heart}
          items={draft.gratitude}
          onChange={items => setDraft(d => ({ ...d, gratitude: items }))}
          placeholder="I am grateful for..."
          accentClass="text-emerald-400"
        />

        <div className="flex gap-2 pt-1">
          <Button
            onClick={save}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 text-white flex-1"
          >
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              : <><Save className="mr-2 h-4 w-4" /> Save</>
            }
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

  // ── Empty state ─────────────────────────────────────────────
  if (!hasContent) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 p-7 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-violet-400/60" />
          <Heart className="h-5 w-5 text-emerald-400/60" />
          <ScrollText className="h-5 w-5 text-amber-400/60" />
        </div>
        <p className="text-white font-semibold">Your Daily Practice</p>
        <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
          Add your personal pledge, affirmations, and gratitude list — words that ground and inspire you every morning.
        </p>
        <Button
          onClick={openEdit}
          className="bg-violet-600 hover:bg-violet-700 text-white mt-1"
        >
          <Plus className="mr-2 h-4 w-4" /> Set Up Daily Practice
        </Button>
      </div>
    )
  }

  // ── Read mode ───────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Daily Practice</span>
        </div>
        <button
          type="button"
          onClick={openEdit}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>

      {practice!.pledge && <PledgeCard text={practice!.pledge} />}

      {practice!.affirmations.length > 0 && (
        <AffirmationsCard items={practice!.affirmations} />
      )}

      {practice!.gratitude.length > 0 && (
        <GratitudeCard items={practice!.gratitude} />
      )}
    </div>
  )
}
