'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

// Sends a password-reset email. The link signs the user in through
// /auth/callback and lands on /reset-password to choose a new password.
export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setError('Enter a valid email address'); return }
    setSending(true); setError(null)
    const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setSending(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-white">Reset your password</CardTitle>
        <CardDescription className="text-slate-400">We&apos;ll email you a link to choose a new one.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-sm text-emerald-300">
              If an account exists for {email.trim()}, a reset link is on its way. It expires soon, so use it shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)}
                className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" disabled={sending} className="w-full bg-purple-600 text-snow hover:bg-purple-700">
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/login" className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
