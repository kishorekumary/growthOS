import { useState } from 'react'

export interface FinanceCategory {
  name: string
  color: string
}

export const DEFAULT_EXPENSE_CATS: FinanceCategory[] = [
  { name: 'Food',          color: '#f97316' },
  { name: 'Rent',          color: '#a78bfa' },
  { name: 'Transport',     color: '#60a5fa' },
  { name: 'Entertainment', color: '#f472b6' },
  { name: 'Healthcare',    color: '#f87171' },
  { name: 'Shopping',      color: '#fbbf24' },
  { name: 'Utilities',     color: '#34d399' },
  { name: 'Other',         color: '#6b7280' },
]

export const DEFAULT_SAVINGS_CATS: FinanceCategory[] = [
  { name: 'Emergency Fund', color: '#10b981' },
  { name: 'Retirement',     color: '#a78bfa' },
  { name: 'Goal',           color: '#38bdf8' },
  { name: 'Investment',     color: '#2dd4bf' },
  { name: 'Other',          color: '#6b7280' },
]

const LS_KEY = 'finance_categories_v1'

function loadFromStorage(): { expense: FinanceCategory[]; savings: FinanceCategory[] } {
  if (typeof window === 'undefined') return { expense: DEFAULT_EXPENSE_CATS, savings: DEFAULT_SAVINGS_CATS }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { expense: DEFAULT_EXPENSE_CATS, savings: DEFAULT_SAVINGS_CATS }
    const parsed = JSON.parse(raw)
    return {
      expense: Array.isArray(parsed.expense) && parsed.expense.length ? parsed.expense : DEFAULT_EXPENSE_CATS,
      savings: Array.isArray(parsed.savings) && parsed.savings.length ? parsed.savings : DEFAULT_SAVINGS_CATS,
    }
  } catch {
    return { expense: DEFAULT_EXPENSE_CATS, savings: DEFAULT_SAVINGS_CATS }
  }
}

export function useFinanceCategories() {
  const [cats, setCats] = useState<{ expense: FinanceCategory[]; savings: FinanceCategory[] }>(
    loadFromStorage
  )

  function persist(next: { expense: FinanceCategory[]; savings: FinanceCategory[] }) {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    setCats(next)
  }

  function addCategory(type: 'expense' | 'savings', cat: FinanceCategory) {
    if (cats[type].some(c => c.name.toLowerCase() === cat.name.toLowerCase())) return
    persist({ ...cats, [type]: [...cats[type], cat] })
  }

  function removeCategory(type: 'expense' | 'savings', name: string) {
    persist({ ...cats, [type]: cats[type].filter(c => c.name !== name) })
  }

  function updateCategory(type: 'expense' | 'savings', oldName: string, updated: Partial<FinanceCategory>) {
    persist({
      ...cats,
      [type]: cats[type].map(c => c.name === oldName ? { ...c, ...updated } : c),
    })
  }

  function colorFor(type: 'expense' | 'savings', name: string): string {
    return cats[type].find(c => c.name === name)?.color ?? '#6b7280'
  }

  function namesFor(type: 'expense' | 'savings'): string[] {
    return cats[type].map(c => c.name)
  }

  return { cats, addCategory, removeCategory, updateCategory, colorFor, namesFor }
}
