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
  in_session: 'anthropic/claude-haiku-4-5-20251001',
  post_session: 'anthropic/claude-haiku-4-5-20251001',
  deep_analysis: 'anthropic/claude-haiku-4-5-20251001',
  fallback: 'anthropic/claude-haiku-4-5-20251001',
}

// Free models that support tool calling, spread across providers.
// Tested 2026-04-13 — these all handle function calling correctly.
export const FREE_FALLBACK_CHAIN = [
  'openrouter/google/gemma-4-26b-a4b-it:free',
  'openrouter/openai/gpt-oss-120b:free',
  'openrouter/minimax/minimax-m2.5:free',
  'openrouter/arcee-ai/trinity-large-preview:free',
]

export type ModelTier = keyof ModelConfig

export function getModelId(tier: ModelTier, config: ModelConfig): string {
  return config[tier] ?? config.fallback
}

// OpenRouter client — configured with OpenRouter's base URL.
// Uses OPENROUTER_API_KEY env var. OpenRouter speaks the OpenAI API format.
// x-use-responses-api: false forces standard chat completions, avoiding
// Responses API format issues with some models.
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: { 'x-use-responses-api': 'false' },
})

/**
 * Resolve a model config string (e.g. "anthropic/claude-haiku-4-5-20251001") into an
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

/**
 * Find the first available model by making a tiny test call.
 * Returns the model ID that worked, or null if all failed.
 */
export async function findAvailableModel(modelsToTry: string[]): Promise<string | null> {
  for (const modelId of modelsToTry) {
    try {
      const model = resolveModel(modelId)
      const { generateText } = await import('ai')
      await generateText({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        maxOutputTokens: 1,
      })
      return modelId
    } catch (err) {
      console.warn(`[model-router] ${modelId} unavailable:`, (err as Error).message?.slice(0, 100))
      continue
    }
  }
  return null
}
