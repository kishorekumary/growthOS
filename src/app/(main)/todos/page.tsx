'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const TodoList = dynamic(() => import('@/components/todos/TodoList'), {
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  ),
})

export default function TodosPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        <p className="text-slate-400 text-sm mt-1">Stay focused, get things done</p>
      </div>
      <TodoList />
    </div>
  )
}
