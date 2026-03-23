import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from 'ai'
import type { Json } from '@/lib/supabase/types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createGymTools } from '@/lib/ai/tools'
import { createFreeChatTools } from '@/lib/ai/tools-free-chat'
import { getModelId, resolveModel, DEFAULT_MODEL_CONFIG, type ModelConfig } from '@/lib/ai/model-router'
import { estimateCost } from '@/lib/ai/cost-tracker'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { createConversation, addMessage } from '@/lib/db/conversations'
import { getSessionDetail } from '@/lib/db/sessions'
import { emitToVault } from '@/lib/vault/emit'

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

    const { messages, conversationId: existingConvId, sessionId }:
      { messages: UIMessage[]; conversationId?: string; sessionId?: string } = await request.json()
    console.log('[chat] messages:', messages.length)

    // Create or reuse conversation
    let conversationId = existingConvId
    if (!conversationId) {
      const { data: conv } = await createConversation(supabase, {
        userId: user.id,
        type: sessionId ? 'session' : 'question',
        sessionId,
      })
      conversationId = conv?.id
      console.log('[chat] created conversation:', conversationId)
    }

    // Persist the latest user message (fire-and-forget, never block stream)
    const lastUserMsg = messages.filter(m => m.role === 'user').at(-1)
    if (lastUserMsg && conversationId) {
      const textContent = lastUserMsg.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('') ?? ''
      addMessage(supabase, {
        conversationId,
        role: 'user',
        content: textContent,
      }).catch(err => console.error('[chat] failed to persist user message:', err))
    }

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

    // Select tools based on mode: session gets logging tools, free chat gets read-only + check-in
    let tools
    if (sessionId) {
      const { start_session: _, ...sessionTools } = createGymTools(supabase, user.id)
      tools = sessionTools
    } else {
      tools = createFreeChatTools(supabase, user.id)
    }
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
        // Persist assistant messages (fire-and-forget, never block stream)
        if (conversationId) {
          if (event.text) {
            addMessage(supabase, {
              conversationId,
              role: 'assistant',
              content: event.text,
              toolCalls: event.toolCalls?.length ? (event.toolCalls as unknown as Json) : undefined,
            }).catch(err => console.error('[chat] failed to persist assistant message:', err))
          }
          if (event.toolResults?.length) {
            addMessage(supabase, {
              conversationId,
              role: 'tool',
              content: null,
              toolCalls: event.toolResults as unknown as Json,
            }).catch(err => console.error('[chat] failed to persist tool results:', err))
          }
        }
        // Emit vault event on session end
        if (event.toolResults?.length) {
          for (const tr of event.toolResults) {
            if (tr.toolName === 'end_session' && 'result' in tr) {
              const result = tr.result as Record<string, unknown>
              if (sessionId) {
                getSessionDetail(supabase, sessionId).then(({ data: detail }) => {
                  if (!detail) return
                  const exercises = [...new Set(
                    (detail.session_sets ?? []).map((s: Record<string, unknown>) =>
                      (s.exercises as Record<string, string> | null)?.name ?? 'Unknown'
                    )
                  )]
                  const durationMin = detail.ended_at
                    ? Math.round((new Date(detail.ended_at).getTime() - new Date(detail.started_at).getTime()) / 60000)
                    : 0
                  emitToVault({
                    type: 'gym_session',
                    date: detail.started_at,
                    duration_min: durationMin,
                    exercises: exercises as string[],
                    total_sets: (detail.session_sets ?? []).length,
                    summary: `${exercises.length} exercises, ${(detail.session_sets ?? []).length} sets, ${durationMin}min`,
                    tags: ['gym', 'session'],
                  }).catch(() => {})
                }).catch(err => console.error('[vault] session detail fetch failed:', err))
              }
            }
          }
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

    const response = result.toUIMessageStreamResponse()
    if (conversationId) {
      response.headers.set('X-Conversation-Id', conversationId)
    }
    return response
  } catch (error) {
    console.error('[chat] unhandled error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
