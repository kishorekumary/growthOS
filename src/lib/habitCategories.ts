export const HABIT_CATEGORIES = ['health', 'wealth', 'leadership', 'social', 'family'] as const

export type HabitCategory = typeof HABIT_CATEGORIES[number]

export const HABIT_CATEGORY_META: Record<HabitCategory, {
  label: string
  emoji: string
  badge: string   // bg + text classes for a small badge/pill
}> = {
  health:     { label: 'Health',     emoji: '💪', badge: 'bg-emerald-500/20 text-emerald-300' },
  wealth:     { label: 'Wealth',     emoji: '💰', badge: 'bg-amber-500/20 text-amber-300' },
  leadership: { label: 'Leadership', emoji: '👑', badge: 'bg-violet-500/20 text-violet-300' },
  social:     { label: 'Social',     emoji: '🤝', badge: 'bg-sky-500/20 text-sky-300' },
  family:     { label: 'Family',     emoji: '👨‍👩‍👧', badge: 'bg-rose-500/20 text-rose-300' },
}
