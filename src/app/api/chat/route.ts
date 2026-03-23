import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createGymTools } from '@/lib/ai/tools'
import { getModelId, resolveModel, DEFAULT_MODEL_CONFIG, type ModelConfig } from '@/lib/ai/model-router'
import { estimateCost } from '@/lib/ai/cost-tracker'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'

export async function POST(request: Request) {
  try {
    console.log('[chat] incoming request')

    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('[chat] auth failed:', authError?.message ?? 'no user')
      return new Response('Unauthorized', { status: 401 })
    }

    console.log('[chat] user:', user.email)

    const { messages }: { messages: UIMessage[] } = await request.json()
    console.log('[chat] messages:', messages.length)

    // Load user's model config (or use defaults)
    const { data: configRow } = await supabase
      .from('model_config')
      .select('config')
      .eq('user_id', user.id)
      .single()

    // config column is jsonb — cast through unknown to our typed shape
    const modelConfig: ModelConfig = (configRow?.config as unknown as ModelConfig) ?? DEFAULT_MODEL_CONFIG
    const modelId = getModelId('in_session', modelConfig)
    console.log('[chat] model:', modelId)

    const tools = createGymTools(supabase, user.id)
    const systemPrompt = await buildSystemPrompt(supabase, user.id)
    console.log('[chat] system prompt loaded, length:', systemPrompt.length)

    const result = streamText({
      model: resolveModel(modelId),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      onStepFinish: (event) => {
        console.log(`[chat] step: ${(event as Record<string, unknown>).stepType ?? 'unknown'}`)
        if (event.text) console.log(`[chat] text: ${event.text.slice(0, 200)}`)
        if (event.toolCalls?.length) {
          for (const tc of event.toolCalls) {
            console.log(`[chat] tool call: ${tc.toolName}(${JSON.stringify('args' in tc ? tc.args : tc.input)})`)
          }
        }
        if (event.toolResults?.length) {
          for (const tr of event.toolResults) {
            console.log(`[chat] tool result: ${tr.toolName} →`, JSON.stringify('result' in tr ? tr.result : tr.output).slice(0, 200))
          }
        }
        if (event.usage) {
          console.log(`[chat] tokens: ${event.usage.inputTokens}in/${event.usage.outputTokens}out`)
        }
      },
      onFinish: async ({ usage }) => {
        console.log('[chat] finished')
        if (usage) {
          const cost = estimateCost(modelId, usage.inputTokens ?? 0, usage.outputTokens ?? 0)
          console.log(`[chat] total: ${usage.inputTokens}in/${usage.outputTokens}out, $${cost.toFixed(6)}`)
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
      onError: ({ error }) => {
        console.error('[chat] stream error:', error)
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[chat] unhandled error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
