import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export interface ModelConfig {
  in_session: string
  post_session: string
  deep_analysis: string
  fallback: string
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  in_session: 'anthropic/claude-haiku-4-5',
  post_session: 'anthropic/claude-sonnet-4-6',
  deep_analysis: 'opus-local',
  fallback: 'google/gemini-2.5-flash',
}

export type ModelTier = keyof ModelConfig

export function getModelId(tier: ModelTier, config: ModelConfig): string {
  return config[tier] ?? config.fallback
}

// OpenRouter client — configured with OpenRouter's base URL.
// Uses OPENROUTER_API_KEY env var. OpenRouter speaks the OpenAI API format.
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

/**
 * Resolve a model config string (e.g. "anthropic/claude-haiku-4.5") into an
 * AI SDK model object. Supports three routing modes:
 *
 * - "anthropic/model-name" → direct Anthropic SDK (uses ANTHROPIC_API_KEY)
 * - "openrouter/model-name" → OpenRouter (uses OPENROUTER_API_KEY)
 * - plain string → passed to AI Gateway (works on Vercel with OIDC)
 *
 * This lets the settings UI swap providers without code changes.
 */
export function resolveModel(modelId: string): LanguageModel {
  if (modelId.startsWith('anthropic/')) {
    const model = modelId.replace('anthropic/', '')
    return anthropic(model) as LanguageModel
  }

  if (modelId.startsWith('openrouter/')) {
    const model = modelId.replace('openrouter/', '')
    return openrouter(model) as LanguageModel
  }

  // Fallback: treat as AI Gateway model string (works when deployed to Vercel
  // with OIDC auth, or locally with AI_GATEWAY_API_KEY)
  return anthropic(modelId) as LanguageModel
}
