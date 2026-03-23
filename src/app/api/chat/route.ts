import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createGymTools } from '@/lib/ai/tools'
import { getModelId, resolveModel, DEFAULT_MODEL_CONFIG, type ModelConfig } from '@/lib/ai/model-router'
import { estimateCost } from '@/lib/ai/cost-tracker'
import { GYM_COMPANION_SYSTEM_PROMPT } from '@/lib/ai/system-prompt'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages }: { messages: UIMessage[] } = await request.json()

  // Load user's model config (or use defaults)
  const { data: configRow } = await supabase
    .from('model_config')
    .select('config')
    .eq('user_id', user.id)
    .single()

  // config column is jsonb — cast through unknown to our typed shape
  const modelConfig: ModelConfig = (configRow?.config as unknown as ModelConfig) ?? DEFAULT_MODEL_CONFIG
  const modelId = getModelId('in_session', modelConfig)

  const tools = createGymTools(supabase, user.id)

  const result = streamText({
    model: resolveModel(modelId),
    system: GYM_COMPANION_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ usage }) => {
      if (usage) {
        await supabase.from('ai_usage').insert({
          user_id: user.id,
          model: modelId,
          task_type: 'in_session',
          tokens_in: usage.inputTokens ?? 0,
          tokens_out: usage.outputTokens ?? 0,
          estimated_cost: estimateCost(modelId, usage.inputTokens ?? 0, usage.outputTokens ?? 0),
        })
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
