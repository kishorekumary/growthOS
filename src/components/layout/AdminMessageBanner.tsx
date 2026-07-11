'use client'

import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCachedQuery } from '@/hooks/useCachedQuery'

interface AdminMessage {
  id: string
  title: string
  body: string
  created_at: string
}

export default function AdminMessageBanner() {
  const { data: messages } = useCachedQuery<AdminMessage[]>(
    'admin-messages',
    (supabase, userId) => supabase
      .from('admin_messages')
      .select('id, title, body, created_at')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(5),
    [],
    []
  )

  const { data: readIds } = useCachedQuery<string[]>(
    'admin-message-reads',
    async (supabase, userId) => {
      const { data, error } = await supabase
        .from('admin_message_reads')
        .select('message_id')
        .eq('user_id', userId)
      return { data: data ? data.map((r: any) => r.message_id) : data, error }
    },
    [],
    []
  )

  const [dismissed, setDismissed] = useState<string[]>([])

  async function dismiss(id: string) {
    setDismissed(d => [...d, id])
    const sb = createSupabaseBrowserClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    await sb.from('admin_message_reads').upsert({ message_id: id, user_id: user.id })
  }

  const shown = messages.filter(m => !readIds.includes(m.id) && !dismissed.includes(m.id))
  if (!shown.length) return null

  return (
    <div className="fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4 space-y-2 pointer-events-none">
      {shown.map(msg => (
        <div
          key={msg.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-violet-500/30 bg-[#0d0d1a]/95 backdrop-blur-sm shadow-2xl px-4 py-3"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 shrink-0 mt-0.5">
            <Bell className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{msg.title}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{msg.body}</p>
          </div>
          <button
            onClick={() => dismiss(msg.id)}
            className="text-slate-600 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
