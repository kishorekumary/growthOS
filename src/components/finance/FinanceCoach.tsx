'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  'How can I build a 6-month emergency fund?',
  'What\'s the best way to pay off debt faster?',
  'How should I start investing with limited income?',
]

export default function FinanceCoach() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const next: Message[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/finance-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Sorry, try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[520px]">
      <h2 className="font-semibold text-white mb-4 shrink-0">Finance Coach</h2>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                <Wallet className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-white">Your Finance Coach</p>
              <p className="text-xs text-slate-500 mt-1">
                Ask anything about budgeting, saving, investing, or debt.
              </p>
            </div>
            <div className="space-y-2">
              {STARTERS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 hover:border-white/20 hover:text-white transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-white/10 text-slate-200 rounded-bl-sm'
            )}>
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

      <div className="flex gap-2 pt-3 shrink-0 border-t border-white/10 mt-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask your coach…"
          disabled={loading}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
        />
        <Button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          size="icon"
          className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
