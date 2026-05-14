import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { openai } from '@/lib/claude'
import { format, parseISO, differenceInDays, addDays } from 'date-fns'

const MILESTONES = [7, 21, 30, 45, 60, 75, 90]

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { challengeId, type = 'daily' } = await req.json()
  if (!challengeId) return NextResponse.json({ error: 'challengeId required' }, { status: 400 })

  const admin = createSupabaseAdminClient()

  const { data: challenge } = await admin
    .from('ninety_day_challenges')
    .select('*')
    .eq('id', challengeId)
    .eq('user_id', user.id)
    .single()

  if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const today      = new Date()
  const startDate  = parseISO(challenge.start_date)
  const dayNumber  = Math.min(differenceInDays(today, startDate) + 1, 90)
  const isMilestone = MILESTONES.includes(dayNumber)

  // For milestone messages: check cache first
  if (type === 'milestone' && isMilestone) {
    const { data: cached } = await admin
      .from('challenge_milestones')
      .select('message')
      .eq('challenge_id', challengeId)
      .eq('day_number', dayNumber)
      .maybeSingle()

    if (cached) return NextResponse.json({ message: cached.message, milestone: true, dayNumber, cached: true })
  }

  // Fetch checkin stats
  const { data: checkins } = await admin
    .from('challenge_checkins')
    .select('checkin_date,completed,reflection')
    .eq('challenge_id', challengeId)
    .eq('user_id', user.id)

  const checkinMap = new Map((checkins ?? []).map(c => [c.checkin_date, c]))
  const completedCount = (checkins ?? []).filter(c => c.completed).length

  // Calculate streak
  let streak = 0
  let d = new Date(today)
  const todayStr = format(today, 'yyyy-MM-dd')
  if (!checkinMap.has(todayStr)) d = addDays(d, -1)
  for (let i = 0; i < dayNumber; i++) {
    const key = format(d, 'yyyy-MM-dd')
    if (!checkinMap.get(key)?.completed) break
    streak++
    d = addDays(d, -1)
  }

  const phase = dayNumber <= 30 ? 'Foundation' : dayNumber <= 60 ? 'Momentum' : 'Mastery'

  let prompt: string

  if (type === 'milestone' && isMilestone) {
    const milestoneLabel = dayNumber === 90 ? 'CHALLENGE COMPLETE' : `Day ${dayNumber} Milestone`
    prompt = `You are a personal transformation coach writing a milestone message for someone who just reached ${milestoneLabel} of their 90-day challenge.

Challenge: "${challenge.title}"
Category: ${challenge.category}
Daily commitment: ${challenge.daily_commitment ?? 'not specified'}
Why it matters: ${challenge.why_matters ?? 'not specified'}
Days completed: ${completedCount} out of ${dayNumber} days
Current streak: ${streak} days

${dayNumber === 90
  ? 'This person just completed their entire 90-day challenge! Write a powerful, emotional celebration message (4-5 sentences) that honors their journey, acknowledges the transformation, and encourages them to reflect on how far they\'ve come.'
  : `Write a milestone message (3-4 sentences) that celebrates reaching day ${dayNumber}, reflects on the ${phase} phase journey so far, and energizes them for what's ahead. Be specific to their challenge.`
}

Be warm, personal, and inspiring. Speak directly to them (use "you").`
  } else {
    const recentReflections = (checkins ?? [])
      .filter(c => c.reflection)
      .slice(-3)
      .map(c => `"${c.reflection}"`)
      .join('; ')

    prompt = `You are a personal transformation coach. Write a daily motivational message (2-3 sentences) for someone on Day ${dayNumber} of their 90-day challenge.

Challenge: "${challenge.title}"
Daily commitment: ${challenge.daily_commitment ?? 'not specified'}
Phase: ${phase} phase (${phase === 'Foundation' ? 'days 1-30, building the habit' : phase === 'Momentum' ? 'days 31-60, deepening the practice' : 'days 61-90, mastering and integrating'})
Streak: ${streak} consecutive days
Completion rate: ${completedCount}/${dayNumber} days (${Math.round(completedCount / Math.max(dayNumber, 1) * 100)}%)
${recentReflections ? `Recent reflections: ${recentReflections}` : ''}

Be direct, energizing, and specific to their challenge and current phase. No generic motivational fluff.`
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.choices[0]?.message?.content ?? '').trim()

  // Cache milestone messages
  if (type === 'milestone' && isMilestone) {
    await admin.from('challenge_milestones').upsert({
      challenge_id: challengeId,
      user_id: user.id,
      day_number: dayNumber,
      message: text,
    }, { onConflict: 'challenge_id,day_number' })
  }

  return NextResponse.json({ message: text, milestone: isMilestone && type === 'milestone', dayNumber, cached: false })
}
