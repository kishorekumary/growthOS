'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Reached from the reset email (signed in by /auth/callback). Also works
// for anyone signed in who wants to set or change a password — e.g. a
// Google user adding one so they can sign in with a username.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady]       = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    createSupabaseBrowserClient().auth.getSession().then(({ data }) => setReady(!!data.session))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Use at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords don’t match'); return }
    setSaving(true); setError(null)
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password })
    setSaving(false)
    if (error) { setError(error.message); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-white">Choose a new password</CardTitle>
        <CardDescription className="text-slate-400">At least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        {ready === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
        ) : !ready ? (
          <p className="text-sm text-slate-400">
            This link has expired or was already used.{' '}
            <Link href="/forgot-password" className="text-purple-400 hover:text-purple-300">Send a new one</Link>.
          </p>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-300">New password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
                className="border-white/20 bg-white/5 text-white focus-visible:ring-purple-500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-slate-300">Confirm password</Label>
              <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}
                className="border-white/20 bg-white/5 text-white focus-visible:ring-purple-500" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" disabled={saving} className="w-full bg-purple-600 text-snow hover:bg-purple-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
