import { describe, expect, it } from 'vitest'
import { findUnlocks } from '@/lib/rewardUnlocks'

const catalog = [
  { id: 'coffee', title: 'Coffee', point_cost: 100 },
  { id: 'lunch', title: 'Lunch out', point_cost: 600 },
  { id: 'clothes', title: 'New clothes', point_cost: 1500 },
]

describe('findUnlocks', () => {
  it('announces nothing the first time, but remembers what is affordable', () => {
    expect(findUnlocks(catalog, 700, null)).toEqual({ announce: [], nextSeen: ['coffee', 'lunch'] })
  })

  it('announces rewards that newly became affordable, biggest first', () => {
    const { announce, nextSeen } = findUnlocks(catalog, 1600, new Set(['coffee']))
    expect(announce.map(c => c.id)).toEqual(['clothes', 'lunch'])
    expect(nextSeen).toEqual(['coffee', 'lunch', 'clothes'])
  })

  it('does not repeat an announcement', () => {
    expect(findUnlocks(catalog, 700, new Set(['coffee', 'lunch'])).announce).toEqual([])
  })

  it('celebrates again after redeeming and re-earning', () => {
    const afterRedeem = findUnlocks(catalog, 100, new Set(['coffee', 'lunch']))
    expect(afterRedeem.nextSeen).toEqual(['coffee'])
    const reEarned = findUnlocks(catalog, 650, new Set(afterRedeem.nextSeen))
    expect(reEarned.announce.map(c => c.id)).toEqual(['lunch'])
  })
})
