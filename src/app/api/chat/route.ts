import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { getModelId, resolveModel, DEFAULT_MODEL_CONFIG } from '@/lib/ai/model-router'
import { buildSystemPromptV2 } from '@/lib/ai/system-prompt-v2'

export async function POST(request: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await request.json()
    console.log('[v2/chat] messages:', messages.length)

    // Model config used to be per-user in Supabase. Solo system now — defaults.
    const modelId = getModelId('in_session', DEFAULT_MODEL_CONFIG)
    console.log('[v2/chat] model:', modelId)

    const systemPrompt = await buildSystemPromptV2()

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
