import { redirect } from 'next/navigation'

// Tasks became the Planner; keep old links and bookmarks working.
export default function TodosPage() {
  redirect('/planner')
}
