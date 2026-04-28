import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createSupabaseBrowserClient() {
  // No explicit auth options — @supabase/ssr sets up PKCE + cookie storage internally.
  // Passing auth options here can override the package's storage adapter and break the
  // PKCE code verifier lookup on the server-side callback.
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
