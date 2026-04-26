export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface FitnessProfile {
  id: string
  user_id: string
  weight_kg: number | null
  height_cm: number | null
  age: number | null
  fitness_goal: 'weight_loss' | 'muscle_gain' | 'endurance' | 'flexibility' | 'general_health' | null
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active' | null
  weekly_workout_target: number | null
  preferred_workout_types: string[]
  created_at: string
  updated_at: string
}

export interface FinancialProfile {
  id: string
  user_id: string
  monthly_income: number | null
  monthly_expenses: number | null
  savings_goal: number | null
  currency: string
  financial_goals: FinancialGoal[]
  created_at: string
  updated_at: string
}

export interface FinancialGoal {
  id: string
  title: string
  target_amount: number
  current_amount: number
  deadline: string | null
  category: 'emergency_fund' | 'retirement' | 'home' | 'travel' | 'education' | 'other'
}

export interface BookPreferences {
  id: string
  user_id: string
  favorite_genres: string[]
  reading_goal_per_year: number | null
  books_read_this_year: number
  currently_reading: BookEntry | null
  reading_list: BookEntry[]
  completed_books: BookEntry[]
  created_at: string
  updated_at: string
}

export interface BookEntry {
  id: string
  title: string
  author: string
  isbn: string | null
  cover_url: string | null
  genre: string | null
  rating: number | null
  notes: string | null
  started_at: string | null
  finished_at: string | null
}

export interface PersonalityProfile {
  id: string
  user_id: string
  mbti_type: string | null
  big_five: BigFiveScores | null
  strengths: string[]
  values: string[]
  communication_style: string | null
  created_at: string
  updated_at: string
}

export interface BigFiveScores {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}
