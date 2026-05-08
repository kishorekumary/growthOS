import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Brain, Sparkles, RefreshCw, NotebookPen, Repeat2, Smile } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { MBTI_TYPES } from '@/lib/mbti'

export default async function PersonalityOverviewPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assessment } = await supabase
    .from('personality_assessments')
    .select('mbti_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const mbtiType = assessment?.mbti_type
  const typeData = mbtiType ? MBTI_TYPES[mbtiType] : null

  return (
    <div className="space-y-4">
      {/* MBTI card */}
      {mbtiType && typeData ? (
        <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-violet-600/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Your Personality Type</p>
              <h2 className="text-4xl font-bold text-white tracking-tight">{mbtiType}</h2>
              <p className="text-violet-300 font-medium mt-1">{typeData.name}</p>
              <p className="text-sm text-slate-400 mt-1">{typeData.tagline}</p>
              <p className="text-xs text-slate-600 mt-2">
                Assessed {formatDistanceToNow(new Date(assessment.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20">
              <Brain className="h-8 w-8 text-violet-300" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Strengths</p>
              <ul className="space-y-1">
                {typeData.strengths.slice(0, 3).map((s) => (
                  <li key={s} className="text-sm text-slate-300 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />{s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Growth Areas</p>
              <ul className="space-y-1">
                {typeData.growth.slice(0, 3).map((g) => (
                  <li key={g} className="text-sm text-slate-300 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />{g}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link
            href="/personality/assessment"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Retake Assessment
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 mx-auto mb-4">
            <Brain className="h-7 w-7 text-violet-300" />
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">Discover your personality type</h2>
          <p className="text-slate-400 text-sm mb-5">
            Complete the 20-question assessment to unlock your MBTI profile, strengths, and personalized growth plan.
          </p>
          <Link
            href="/personality/assessment"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            <Sparkles className="h-4 w-4" /> Take Assessment
          </Link>
        </div>
      )}

      {/* Growth tools */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide px-1">Growth tools</p>
        {[
          { href: '/habits',  icon: Repeat2,     label: 'Habits',       desc: 'Build streaks across all life areas',  color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
          { href: '/journal', icon: NotebookPen, label: 'Voice Journal', desc: 'Reflect with voice or text daily',     color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { href: '/checkin', icon: Smile,       label: 'Daily Check-in', desc: 'Mood, sleep, and life balance score', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map(({ href, icon: Icon, label, desc, color, bg }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 hover:border-white/15 hover:bg-white/5 transition-all group"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 text-xs transition-colors">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
