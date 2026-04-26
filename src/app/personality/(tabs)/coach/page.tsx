'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, Bot } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mbtiType, setMbtiType] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase
      .from('personality_assessments')
      .select('mbti_type')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.mbti_type) setMbtiType(data.mbti_type)
      })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    const res = await fetch('/api/ai/personality-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...messages, userMsg],
        mbtiType,
      }),
    })

    const data = await res.json()
    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply ?? 'Sorry, I couldn\'t respond right now.' }])
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Context badge */}
      {mbtiType && (
        <div className="mb-4 inline-flex items-center gap-1.5 self-start rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1">
          <Bot className="h-3 w-3 text-violet-400" />
          <span className="text-xs text-violet-300">Coaching for {mbtiType} personality</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 mb-4">
              <Bot className="h-7 w-7 text-violet-300" />
            </div>
            <p className="text-white font-medium mb-1">Your Personal Growth Coach</p>
            <p className="text-slate-400 text-sm max-w-xs">
              Ask me anything about self-improvement, your {mbtiType ?? 'personality'} type, habits, or personal growth.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {['What are my blind spots?', 'How can I improve focus?', 'Best habits for my type?'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s) }}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-white/10 text-slate-200 rounded-bl-sm'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-white/10">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage() }}
          placeholder="Ask your coach..."
          className="border-white/20 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-violet-500"
          disabled={loading}
        />
        <Button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
