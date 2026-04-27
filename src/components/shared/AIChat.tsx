'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, RotateCcw, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase'

type Section = 'personality' | 'fitness' | 'finance' | 'books'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const PERSONAS: Record<Section, { name: string; tagline: string; starters: string[] }> = {
  personality: {
    name: 'Sage',
    tagline: 'Your guide for deeper self-understanding',
    starters: [
      'What does my personality type say about how I handle stress?',
      'How can I build stronger relationships aligned with my values?',
      'What habits will help me grow as a person?',
    ],
  },
  fitness: {
    name: 'Coach Alex',
    tagline: 'Your energetic, motivating fitness partner',
    starters: [
      'What should I eat before a morning workout?',
      'How do I improve my running endurance?',
      "What's a good beginner strength routine?",
    ],
  },
  finance: {
    name: 'Advisor Morgan',
    tagline: 'Your calm, practical financial guide',
    starters: [
      'How can I build a 6-month emergency fund?',
      "What's the best way to pay off debt faster?",
      'How should I start investing with limited income?',
    ],
  },
  books: {
    name: 'Librarian Quinn',
    tagline: 'Your curious, thoughtful literary companion',
    starters: [
      'What book should I read to improve my mindset?',
      'Can you suggest a book based on my interests?',
      'How do I build a consistent reading habit?',
    ],
  },
}

export default function AIChat({ section }: { section: Section }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const persona = PERSONAS[section]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadHistory = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data } = await supabase
        .from('ai_conversations')
        .select('role, content, created_at')
        .eq('section', section)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data && data.length > 0) {
        setMessages(
          [...data].reverse().map(r => ({
            role: r.role as 'user' | 'assistant',
            content: r.content,
          }))
        )
      }
    } catch {
      // history is optional — silently ignore errors
    } finally {
      setHistoryLoaded(true)
    }
  }, [section])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function newConversation() {
    setMessages([])
    setSessionId(crypto.randomUUID())
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    setMessages(prev => [
      ...prev,
      { role: 'user', content },
      { role: 'assistant', content: '' },
    ])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, session_id: sessionId, message: content }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Sorry, I ran into an issue. Please try again.',
          }
          return updated
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        aiContent += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: aiContent }
          return updated
        })
      }

      if (!aiContent) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Sorry, I ran into an issue. Please try again.',
          }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, I ran into an issue. Please try again.',
        }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="font-semibold text-white">{persona.name}</h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={newConversation}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New conversation
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && historyLoaded && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-3">
                <Bot className="h-5 w-5 text-violet-400" />
              </div>
              <p className="text-sm font-medium text-white">{persona.name}</p>
              <p className="text-xs text-slate-500 mt-1">{persona.tagline}</p>
            </div>
            <div className="space-y-2">
              {persona.starters.map(s => (
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

        {!historyLoaded && messages.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-white/10 text-slate-200 rounded-bl-sm'
              )}
            >
              {msg.content ? (
                msg.content
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 shrink-0 border-t border-white/10 mt-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={`Ask ${persona.name}…`}
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
