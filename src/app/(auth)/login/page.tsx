'use client'

import { useState, useEffect, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, CheckCircle2 } from 'lucide-react'
import { isEmailIdentifier } from '@/lib/username'

import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

// One field for either an email or a username (migration 055).
const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

function OAuthError({ onError }: { onError: (msg: string) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) onError(decodeURIComponent(error))
  }, [searchParams, onError])
  return null
}

function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const [magicSending, setMagicSending] = useState(false)
  const [magicSentTo, setMagicSentTo]   = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true)
    setServerError(null)
    const supabase = createSupabaseBrowserClient()

    // Username: resolved and signed in on the server, which sets the session.
    if (!isEmailIdentifier(values.identifier)) {
      const res = await fetch('/api/auth/username-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: values.identifier, password: values.password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(data.error ?? 'Invalid username or password')
        setIsLoading(false)
        return
      }
      router.push(data.next ?? '/dashboard')
      router.refresh()
      return
    }

    const { data: signIn, error } = await supabase.auth.signInWithPassword({
      email: values.identifier.trim(),
      password: values.password,
    })

    if (error) {
      setServerError(error.message)
      setIsLoading(false)
      return
    }

    // Scope to this user: admins can read every profile, so an unscoped
    // .single() matched many rows, failed, and sent them to onboarding.
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_done')
      .eq('id', signIn.user.id)
      .maybeSingle()

    router.push(profile?.onboarding_done ? '/dashboard' : '/onboarding')
  }

  // Passwordless: a one-time sign-in link to an existing account's email.
  async function sendMagicLink() {
    const id = (getValues('identifier') ?? '').trim()
    setServerError(null)
    if (!isEmailIdentifier(id)) { setServerError('Enter your email above to get a sign-in link'); return }
    setMagicSending(true)
    const { error } = await createSupabaseBrowserClient().auth.signInWithOtp({
      email: id,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
    })
    setMagicSending(false)
    if (error) { setServerError(error.message); return }
    setMagicSentTo(id)
  }

  async function handleGoogleLogin() {
    setIsGoogleLoading(true)
    setServerError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setServerError(error.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
      <Suspense fallback={null}>
        <OAuthError onError={setServerError} />
      </Suspense>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-white">Welcome back</CardTitle>
        <CardDescription className="text-slate-400">Sign in to your account</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Google OAuth */}
        <Button
          type="button"
          variant="outline"
          className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-transparent px-2 text-slate-500">or</span>
          </div>
        </div>

        {/* Email / Password form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-slate-300">Email or username</Label>
            <Input
              id="identifier"
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="you@example.com or username"
              autoComplete="username"
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
              {...register('identifier')}
            />
            {errors.identifier && (
              <p className="text-xs text-red-400">{errors.identifier.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
              <p className="text-xs text-red-400">{serverError}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-snow"
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        {magicSentTo ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-xs text-emerald-300">Check {magicSentTo} for a sign-in link. It works once and expires soon.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={sendMagicLink}
            disabled={magicSending || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] py-2 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            {magicSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Email me a sign-in link instead
          </button>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
