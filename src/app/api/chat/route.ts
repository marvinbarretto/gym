import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getModelId, resolveModel, DEFAULT_MODEL_CONFIG, type ModelConfig } from '@/lib/ai/model-router'
import { buildSystemPromptV2 } from '@/lib/ai/system-prompt-v2'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401 })

    const { messages }: { messages: UIMessage[] } = await request.json()
    console.log('[v2/chat] user:', user.email, '| messages:', messages.length)

    const { data: configRow } = await supabase
      .from('model_config')
      .select('config')
      .eq('user_id', user.id)
      .single()

    const modelConfig: ModelConfig = (configRow?.config as unknown as ModelConfig) ?? DEFAULT_MODEL_CONFIG
    const modelId = getModelId('in_session', modelConfig)
    console.log('[v2/chat] model:', modelId)

    const systemPrompt = await buildSystemPromptV2(supabase)

    const result = streamText({
      model: resolveModel(modelId),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      onFinish: ({ usage }) => {
        if (usage) {
          console.log(`[v2/chat] tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`)
        }
      },
      onError: ({ error }) => {
        console.error('[v2/chat] stream error:', error)
      },
    })

    const response = result.toUIMessageStreamResponse()
    response.headers.set('X-Model-Id', modelId)
    return response
  } catch (error) {
    console.error('[v2/chat] error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
