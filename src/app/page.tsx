import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export default async function RootPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_done')
    .eq('id', user.id)
    .maybeSingle()

  redirect(profile?.onboarding_done ? '/dashboard' : '/onboarding')
}
