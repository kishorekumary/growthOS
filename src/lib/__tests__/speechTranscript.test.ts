import { describe, expect, it } from 'vitest'
import { mergeFinalTranscripts, newSpeechText } from '@/lib/speechTranscript'

describe('mergeFinalTranscripts', () => {
  it('joins separate phrases (desktop Chrome)', () => {
    expect(mergeFinalTranscripts(['log 2 eggs', ' for breakfast'])).toBe('log 2 eggs for breakfast')
  })
  it('collapses cumulative finals (Android)', () => {
    expect(mergeFinalTranscripts(['buy', 'buy milk', 'buy milk today'])).toBe('buy milk today')
  })
  it('drops re-sent duplicate finals', () => {
    expect(mergeFinalTranscripts(['ran 5 km', 'ran 5 km', 'ran 5 km'])).toBe('ran 5 km')
  })
  it('ignores case and spacing differences', () => {
    expect(mergeFinalTranscripts(['Spent 200', 'spent  200 on lunch'])).toBe('spent 200 on lunch')
  })
  it('handles empty input', () => {
    expect(mergeFinalTranscripts(['', '  '])).toBe('')
  })
})

describe('newSpeechText', () => {
  it('returns only the words added since last time', () => {
    expect(newSpeechText('', 'dear diary')).toBe('dear diary')
    expect(newSpeechText('dear diary', 'dear diary today was good')).toBe('today was good')
  })
  it('returns nothing for a re-sent result', () => {
    expect(newSpeechText('dear diary', 'dear diary')).toBe('')
  })
})
