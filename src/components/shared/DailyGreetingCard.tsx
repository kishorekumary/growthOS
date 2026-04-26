'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

export default function DailyGreetingCard({ firstName }: { firstName: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ai/daily-greeting')
      .then((r) => r.json())
      .then((data) => setMessage(data.message ?? null))
      .catch(() => setMessage(null))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-600/10 to-violet-600/5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
          <Sparkles className="h-4 w-4 text-purple-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-purple-300 mb-1">
            {getGreeting()}, {firstName}! 👋
          </p>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded-full bg-white/10 animate-pulse" />
              <div className="h-3.5 w-4/5 rounded-full bg-white/10 animate-pulse" />
            </div>
          ) : message ? (
            <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed">
              Today is a great day to make progress. Focus on one small step forward.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
