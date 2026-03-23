// Approximate costs per 1M tokens — update as prices change
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'anthropic/claude-haiku-4.5': { input: 0.25, output: 1.25 },
  'anthropic/claude-sonnet-4.6': { input: 3, output: 15 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MILLION[model] ?? { input: 1, output: 3 }
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000
}
