'use client'

import Link from 'next/link'
import { Timer, ArrowRight, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { useCachedQuery } from '@/hooks/useCachedQuery'

interface FocusSummary {
  sessions:  number
  totalMins: number
}

export default function FocusDashboardWidget() {
  const { data, loading, isOffline } = useCachedQuery<FocusSummary>(
    'focus:today',
    async (supabase, userId) => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('duration_minutes')
        .eq('user_id', userId)
        .gte('created_at', today)
      if (error) return { data: null, error }
      const list = data ?? []
      return {
        data: {
          sessions:  list.length,
          totalMins: list.reduce((s, f) => s + (f.duration_minutes ?? 25), 0),
        },
        error: null,
      }
    },
    { sessions: 0, totalMins: 0 }
  )
  const { sessions, totalMins } = data

  const hrs  = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : totalMins > 0 ? `${totalMins}m` : null

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Today's Focus</span>
        </div>
        <Link
          href="/focus"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
        >
          Go to Focus <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="h-12 rounded-lg bg-white/5 animate-pulse" />
      ) : sessions === 0 && isOffline ? (
        <p className="text-sm text-slate-400">Can&apos;t load — you&apos;re offline.</p>
      ) : sessions === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-400">No focus sessions today yet.</p>
          <Link
            href="/focus"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            <Zap className="h-4 w-4" />
            Start a Focus Session
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">{sessions}</p>
              <p className="text-xs text-slate-500">session{sessions !== 1 ? 's' : ''} done</p>
            </div>
            {timeLabel && (
              <div>
                <p className="text-2xl font-bold text-violet-400 tabular-nums">{timeLabel}</p>
                <p className="text-xs text-slate-500">focused today</p>
              </div>
            )}
          </div>
          <Link
            href="/focus"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            <Zap className="h-4 w-4 text-violet-400" />
            Start Another Session
          </Link>
        </div>
      )}
    </div>
  )
}
