'use client'

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

export interface LifeScores {
  finance:   number
  fitness:   number
  focus:     number
  knowledge: number
  habits:    number
  goals:     number
  sleep:     number
  mood:      number
}

const DOMAIN_LABELS: Record<keyof LifeScores, string> = {
  finance:   '💰 Finance',
  fitness:   '💪 Fitness',
  focus:     '🎯 Focus',
  knowledge: '📚 Knowledge',
  habits:    '🔁 Habits',
  goals:     '🏆 Goals',
  sleep:     '😴 Sleep',
  mood:      '😊 Mood',
}

const COLORS: Record<keyof LifeScores, string> = {
  finance:   '#22c55e',
  fitness:   '#ef4444',
  focus:     '#06b6d4',
  knowledge: '#a78bfa',
  habits:    '#f59e0b',
  goals:     '#3b82f6',
  sleep:     '#818cf8',
  mood:      '#f472b6',
}

interface Props { scores: LifeScores }

export default function WheelOfLife({ scores }: Props) {
  const data = (Object.keys(scores) as (keyof LifeScores)[]).map(k => ({
    domain: DOMAIN_LABELS[k],
    score: scores[k],
    fullMark: 10,
  }))

  const overall = Math.round(
    Object.values(scores).reduce((s, v) => s + v, 0) / Object.values(scores).length * 10
  ) / 10

  const weakest = (Object.keys(scores) as (keyof LifeScores)[])
    .sort((a, b) => scores[a] - scores[b])
    .slice(0, 2)

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Wheel of Life</p>
          <p className="text-xs text-slate-500 mt-0.5">Balance across all life domains</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{overall}<span className="text-sm text-slate-500">/10</span></p>
          <p className="text-xs text-slate-500">Life Score</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#7c3aed"
            fill="#7c3aed"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ fill: '#a78bfa', r: 3, strokeWidth: 0 }}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
            formatter={(v: number) => [v + '/10', 'Score']}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Domain breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(scores) as (keyof LifeScores)[]).map(k => (
          <div key={k} className="text-center">
            <div className="text-lg font-bold" style={{ color: COLORS[k] }}>{scores[k]}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{DOMAIN_LABELS[k].split(' ')[1]}</div>
          </div>
        ))}
      </div>

      {/* Focus areas */}
      {weakest.some(k => scores[k] < 7) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-1">
          <p className="text-xs font-medium text-amber-400">Areas to focus on this week</p>
          <div className="flex gap-2 flex-wrap">
            {weakest.filter(k => scores[k] < 7).map(k => (
              <span key={k} className="text-xs text-slate-300">{DOMAIN_LABELS[k]}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
