import { describe, it, expect } from 'vitest'
import { estimateCost } from './cost-tracker'

describe('cost-tracker', () => {
  it('estimates cost for known model', () => {
    const cost = estimateCost('anthropic/claude-haiku-4.5', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(1.5) // 0.25 + 1.25
  })

  it('uses conservative default for unknown model', () => {
    const cost = estimateCost('unknown/model', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(4) // 1 + 3
  })

  it('handles zero tokens', () => {
    expect(estimateCost('anthropic/claude-haiku-4.5', 0, 0)).toBe(0)
  })
})
