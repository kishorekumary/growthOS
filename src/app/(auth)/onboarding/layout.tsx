import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Anyone who has already finished onboarding goes straight to the
// dashboard, however they got here (a stale link, an old redirect).
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles').select('onboarding_done').eq('id', user.id).maybeSingle()
    if (profile?.onboarding_done) redirect('/dashboard')
  }
  return <>{children}</>
}
