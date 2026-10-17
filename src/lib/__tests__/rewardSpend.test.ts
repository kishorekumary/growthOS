import { describe, expect, it } from 'vitest'
import { formatSpend, parseSpend } from '@/lib/rewardSpend'

describe('formatSpend', () => {
  it('uses rupees with Indian digit grouping', () => {
    expect(formatSpend(2000)).toBe('₹2,000')
    expect(formatSpend(150000)).toBe('₹1,50,000')
  })
})

describe('parseSpend', () => {
  it('treats empty as no amount', () => expect(parseSpend('  ')).toBeNull())
  it('accepts symbols and separators', () => expect(parseSpend('₹2,000')).toBe(2000))
  it('rejects zero, negatives and junk', () => {
    expect(parseSpend('0')).toBeUndefined()
    expect(parseSpend('-5')).toBeUndefined()
    expect(parseSpend('abc')).toBeUndefined()
  })
})
