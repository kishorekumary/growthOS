import { describe, expect, it } from 'vitest'
import { isEmailIdentifier, normalizeUsername, usernameProblem } from '@/lib/username'

describe('usernames', () => {
  it('normalizes case, spaces and a leading @', () => {
    expect(normalizeUsername('  @YKK ')).toBe('ykk')
  })
  it('accepts valid usernames', () => {
    for (const u of ['ykk', 'kishore.y', 'k_99', 'abc123']) expect(usernameProblem(u)).toBeNull()
  })
  it('rejects bad ones', () => {
    expect(usernameProblem('ab')).toMatch(/3/)
    expect(usernameProblem('a'.repeat(31))).toMatch(/30/)
    expect(usernameProblem('.ykk')).not.toBeNull()
    expect(usernameProblem('ykk_')).not.toBeNull()
    expect(usernameProblem('y kk')).not.toBeNull()
    expect(usernameProblem('ykk!')).not.toBeNull()
  })
  it('tells emails from usernames', () => {
    expect(isEmailIdentifier('ykk.cse@gmail.com')).toBe(true)
    expect(isEmailIdentifier('ykk')).toBe(false)
    expect(isEmailIdentifier('@ykk')).toBe(false)
  })
})
