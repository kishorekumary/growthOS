// Helpers for the Notes notepad. Note bodies are the HTML the rich-text
// editor produces; checklist items are Tiptap task items:
// <li data-type="taskItem" data-checked="true|false">…</li>

export interface NoteSortable {
  is_pinned:  boolean
  updated_at: string
}

// Pinned notes first, then most recently edited.
export function sortNotes<T extends NoteSortable>(notes: T[]): T[] {
  return [...notes].sort((a, b) =>
    Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at))
}

// Ticked vs total checklist items, or null when the note has no checklist.
export function checklistProgress(html: string): { done: number; total: number } | null {
  const items = html.match(/<li\b[^>]*data-type="taskItem"[^>]*>/g)
  if (!items) return null
  return { done: items.filter(tag => tag.includes('data-checked="true"')).length, total: items.length }
}

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

function plainText(html: string): string {
  return html
    .replace(/<\/(p|li|h[1-6])>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, m => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim()
}

// One line of the note's text for the list card.
export function notePreview(html: string, max = 90): string {
  const text = plainText(html)
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

// Nothing worth keeping: no title and no text (empty checklist rows don't count).
export function isBlankNote(title: string, html: string): boolean {
  return !title.trim() && !plainText(html)
}
