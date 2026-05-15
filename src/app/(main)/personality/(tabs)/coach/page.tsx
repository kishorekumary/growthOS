'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Brain, ArrowRight } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import AIChat from '@/components/shared/AIChat'
import { Button } from '@/components/ui/button'

export default function CoachPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'done' | 'missing'>('loading')

  useEffect(() => {
    async function check() {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('missing'); return }

      const { data } = await supabase
        .from('user_profiles')
        .select('mbti_type')
        .eq('id', user.id)
        .maybeSingle()

      setStatus(data?.mbti_type ? 'done' : 'missing')
    }
    check()
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  if (status === 'missing') {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20 border border-violet-500/30">
          <Brain className="h-8 w-8 text-violet-400" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-lg font-semibold text-white">Personality assessment needed</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your AI coach gives advice tailored to your personality type. Complete the questionnaire first — it only takes a few minutes.
          </p>
        </div>
        <Button
          onClick={() => router.push('/personality/assessment')}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
        >
          Take the assessment
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return <AIChat section="personality" />
}
