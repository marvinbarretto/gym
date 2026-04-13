import { describe, it, expect } from 'vitest'
import { getModelId, type ModelConfig, DEFAULT_MODEL_CONFIG } from './model-router'

describe('model-router', () => {
  it('returns in_session model for in_session tier', () => {
    expect(getModelId('in_session', DEFAULT_MODEL_CONFIG)).toBe('anthropic/claude-haiku-4-5-20251001')
  })

  it('returns post_session model for post_session tier', () => {
    expect(getModelId('post_session', DEFAULT_MODEL_CONFIG)).toBe('anthropic/claude-haiku-4-5-20251001')
  })

  it('returns fallback model for unknown tier', () => {
    expect(getModelId('unknown' as any, DEFAULT_MODEL_CONFIG)).toBe('anthropic/claude-haiku-4-5-20251001')
  })

  it('accepts custom config', () => {
    const custom: ModelConfig = {
      in_session: 'custom/model-a',
      post_session: 'custom/model-b',
      deep_analysis: 'opus-local',
      fallback: 'custom/model-c',
    }
    expect(getModelId('in_session', custom)).toBe('custom/model-a')
  })
})
