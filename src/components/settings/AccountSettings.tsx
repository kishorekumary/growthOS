'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AtSign, KeyRound, Loader2, Check } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { normalizeUsername, usernameProblem } from '@/lib/username'
import { cn } from '@/lib/utils'

// Sign-in options for the current user: a username (for "username +
// password" sign-in) and a link to set or change their password. The
// username part hides itself until migration 055 adds the column.
export default function AccountSettings() {
  const [uid, setUid]           = useState<string | null>(null)
  const [email, setEmail]       = useState('')
  const [current, setCurrent]   = useState<string | null>(null)
  const [available, setAvail]   = useState(false)
  const [draft, setDraft]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const db = createSupabaseBrowserClient()
    db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUid(user.id); setEmail(user.email ?? '')
      const { data, error } = await db.from('user_profiles').select('username').eq('id', user.id).maybeSingle()
      if (error) return               // column not there yet
      setAvail(true)
      setCurrent(data?.username ?? null)
      setDraft(data?.username ?? '')
    })
  }, [])

  async function save() {
    if (!uid) return
    const problem = usernameProblem(draft)
    if (problem) { setError(problem); return }
    setSaving(true); setError(null); setSaved(false)
    const username = normalizeUsername(draft)
    const { error } = await createSupabaseBrowserClient().from('user_profiles').update({ username }).eq('id', uid)
    setSaving(false)
    if (error) { setError(error.code === '23505' ? 'That username is taken' : error.message); return }
    setCurrent(username); setDraft(username); setSaved(true)
  }

  const dirty = normalizeUsername(draft) !== (current ?? '')

  return (
    <div className="space-y-3">
      {available && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-violet-400" />
            <p className="text-sm font-semibold text-white">Username</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">Sign in with this and your password instead of your email.</p>
          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">@</span>
              <input
                value={draft}
                onChange={e => { setDraft(e.target.value); setSaved(false); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter' && dirty) save() }}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="choose a username"
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-7 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none"
              />
            </div>
            <button
              onClick={save}
              disabled={saving || !dirty || !draft.trim()}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                saved && !dirty ? 'bg-emerald-600 text-snow' : 'bg-violet-600 text-snow hover:bg-violet-700 disabled:opacity-40')}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved && !dirty ? <Check className="h-3.5 w-3.5" /> : null}
              {saved && !dirty ? 'Saved' : 'Save'}
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>
      )}

      <Link href="/reset-password" className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-4 transition-colors hover:bg-white/5">
        <KeyRound className="h-4 w-4 shrink-0 text-violet-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Password</p>
          <p className="truncate text-xs text-slate-500">Set or change the password for {email || 'your account'}</p>
        </div>
        <span className="text-xs text-violet-300">Change →</span>
      </Link>
    </div>
  )
}
