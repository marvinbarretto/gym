export interface ModelConfig {
  in_session: string
  post_session: string
  deep_analysis: string
  fallback: string
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  in_session: 'anthropic/claude-haiku-4.5',
  post_session: 'anthropic/claude-sonnet-4.6',
  deep_analysis: 'opus-local',
  fallback: 'google/gemini-2.5-flash',
}

export type ModelTier = keyof ModelConfig

export function getModelId(tier: ModelTier, config: ModelConfig): string {
  return config[tier] ?? config.fallback
}
