import { createSupabaseServerClient } from '@/lib/supabase-server'
import TodoList from '@/components/todos/TodoList'

export default async function TodosPage() {
  const supabase = createSupabaseServerClient()
  const { data: todos } = await supabase
    .from('user_todos')
    .select('id, title, notes, due_date, is_completed, completed_at, created_at')
    .order('due_date', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        <p className="text-slate-400 text-sm mt-1">Stay focused, get things done</p>
      </div>
      <TodoList initialTodos={todos ?? []} />
    </div>
  )
}
