export type PeriodType = 'day' | 'week' | 'month'
export const PERIOD_TYPES: PeriodType[] = ['day', 'week', 'month']

export interface PlannerItem {
  id:             string
  user_id:        string
  title:          string
  notes:          string | null
  period_type:    PeriodType
  // YYYY-MM-DD aligned to period_type (the day / the Sunday / the 1st).
  // For repeating items: the first period the item applies to.
  period_start:   string
  repeats:        boolean
  // One-off items only — repeating items track completion per period in
  // planner_completions.
  is_completed:   boolean
  completed_at:   string | null
  points_awarded: number
  carry_count:    number
  ended_at:       string | null
  sort_order:     number
  created_at:     string
}

export interface PlannerCompletion {
  id:             string
  item_id:        string
  period_start:   string
  completed_at:   string
  points_awarded: number
}
