import { describe, expect, it } from 'vitest'
import { checklistProgress, isBlankNote, notePreview, sortNotes } from '@/lib/notes'

const LIST =
  '<p>Saturday 6pm</p>' +
  '<ul data-type="taskList">' +
  '<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Balloons</p></div></li>' +
  '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Cake</p></div></li>' +
  '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Plates</p></div></li>' +
  '</ul>'

describe('checklistProgress', () => {
  it('counts ticked and total checklist items', () => {
    expect(checklistProgress(LIST)).toEqual({ done: 1, total: 3 })
  })
  it('is null when the note has no checklist', () => {
    expect(checklistProgress('<p>Just text</p><ul><li><p>bullet</p></li></ul>')).toBeNull()
  })
})

describe('notePreview', () => {
  it('turns HTML into a short single line of text', () => {
    expect(notePreview('<p>Wi-Fi:&nbsp;zenith</p><p>Door &amp; gate: 4471</p>')).toBe('Wi-Fi: zenith Door & gate: 4471')
  })
  it('cuts long text with an ellipsis', () => {
    const p = notePreview(`<p>${'word '.repeat(40)}</p>`, 20)
    expect(p.length).toBeLessThanOrEqual(21)
    expect(p.endsWith('…')).toBe(true)
  })
})

describe('isBlankNote', () => {
  it('treats a note with no title and only empty markup as blank', () => {
    expect(isBlankNote('', '')).toBe(true)
    expect(isBlankNote('  ', '<p></p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p></p></div></li></ul>')).toBe(true)
  })
  it('is not blank once it has a title or text', () => {
    expect(isBlankNote('Party', '')).toBe(false)
    expect(isBlankNote('', '<p>milk</p>')).toBe(false)
  })
})

describe('sortNotes', () => {
  it('puts pinned notes first, then most recently edited', () => {
    const notes = [
      { id: 'a', is_pinned: false, updated_at: '2026-10-20T10:00:00Z' },
      { id: 'b', is_pinned: true,  updated_at: '2026-10-01T10:00:00Z' },
      { id: 'c', is_pinned: false, updated_at: '2026-10-22T10:00:00Z' },
      { id: 'd', is_pinned: true,  updated_at: '2026-10-05T10:00:00Z' },
    ]
    expect(sortNotes(notes).map(n => n.id)).toEqual(['d', 'b', 'c', 'a'])
  })
})
