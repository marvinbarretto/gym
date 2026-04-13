import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from 'ai'
import type { Json } from '@/lib/supabase/types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createGymTools } from '@/lib/ai/tools'
import { createFreeChatTools } from '@/lib/ai/tools-free-chat'
import { getModelId, resolveModel, findAvailableModel, DEFAULT_MODEL_CONFIG, FREE_FALLBACK_CHAIN, type ModelConfig } from '@/lib/ai/model-router'
import { estimateCost } from '@/lib/ai/cost-tracker'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { createConversation, addMessage } from '@/lib/db/conversations'
import { getSessionDetail } from '@/lib/db/sessions'
import { emitToVault } from '@/lib/vault/emit'

export async function POST(request: Request) {
  try {
    console.log('[chat] ========== NEW REQUEST ==========')

    // --- Auth ---
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('[chat] AUTH FAILED:', authError?.message ?? 'no user')
      return new Response('Unauthorized', { status: 401 })
    }
    console.log('[chat] user:', user.email)

    // --- Parse request body ---
    const { messages, conversationId: existingConvId, sessionId }:
      { messages: UIMessage[]; conversationId?: string; sessionId?: string } = await request.json()
    console.log('[chat] messages:', messages.length, '| sessionId:', sessionId ?? 'NONE', '| convId:', existingConvId ?? 'NEW')

    // --- Conversation ---
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

    // Persist the latest user message (fire-and-forget)
    const lastUserMsg = messages.filter(m => m.role === 'user').at(-1)
    if (lastUserMsg && conversationId) {
      const textContent = lastUserMsg.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('') ?? ''
      console.log('[chat] user said:', textContent.slice(0, 200))
      addMessage(supabase, {
        conversationId,
        role: 'user',
        content: textContent,
      }).catch(err => console.error('[chat] PERSIST USER MSG FAILED:', err))
    }

    // --- Model selection ---
    const { data: configRow } = await supabase
      .from('model_config')
      .select('config')
      .eq('user_id', user.id)
      .single()

    const modelConfig: ModelConfig = (configRow?.config as unknown as ModelConfig) ?? DEFAULT_MODEL_CONFIG
    const primaryModelId = getModelId('in_session', modelConfig)
    const modelsToTry = [primaryModelId, ...FREE_FALLBACK_CHAIN.filter(m => m !== primaryModelId)]
    console.log('[chat] PRIMARY model:', primaryModelId)
    console.log('[chat] FALLBACK chain:', modelsToTry.slice(1).join(', ') || 'none')

    // Preflight: find a model that actually responds
    console.log('[chat] PREFLIGHT: testing models...')
    const modelId = await findAvailableModel(modelsToTry)
    if (!modelId) {
      console.error('[chat] ALL MODELS FAILED preflight. Tried:', modelsToTry.join(', '))
      return new Response(JSON.stringify({ error: 'All models are currently unavailable. Try again in a minute.' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      })
    }
    if (modelId !== primaryModelId) {
      console.log(`[chat] ⚠️ PRIMARY UNAVAILABLE (${primaryModelId}), fell back to: ${modelId}`)
    } else {
      console.log(`[chat] ✅ PRIMARY model available: ${modelId}`)
    }

    // --- Tool selection ---
    // Session mode: logging tools (minus start_session, already started via UI)
    // Free chat mode: read-only tools
    let tools
    const mode = sessionId ? 'SESSION' : 'FREE_CHAT'
    if (sessionId) {
      const { start_session: _, ...sessionTools } = createGymTools(supabase, user.id)
      tools = sessionTools
    } else {
      tools = createFreeChatTools(supabase, user.id)
    }
    const toolNames = Object.keys(tools)
    console.log(`[chat] MODE: ${mode} | TOOLS: ${toolNames.join(', ')}`)

    // --- System prompt ---
    let systemPrompt = await buildSystemPrompt(supabase, user.id)
    // Inject session ID so the model never asks for it
    if (sessionId) {
      systemPrompt += `\n\nACTIVE SESSION: ${sessionId}\nAlways use this session_id for log_set, log_cardio, and end_session calls. Never ask the user for a session ID.`
    }
    console.log('[chat] system prompt length:', systemPrompt.length, 'chars')
    if (sessionId) console.log('[chat] session ID injected into prompt:', sessionId)

    // --- Stream ---
    console.log('[chat] STREAMING with model:', modelId)
    const result = streamText({
      model: resolveModel(modelId),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      onStepFinish: (event) => {
        const stepType = (event as Record<string, unknown>).stepType ?? 'unknown'
        console.log(`[chat] STEP COMPLETE: type=${stepType}`)

        if (event.text) {
          console.log(`[chat] RESPONSE TEXT: "${event.text.slice(0, 300)}"`)
        }

        if (event.toolCalls?.length) {
          for (const tc of event.toolCalls) {
            console.log(`[chat] TOOL CALL: ${tc.toolName}(${JSON.stringify('args' in tc ? tc.args : tc.input)})`)
          }
        }

        if (event.toolResults?.length) {
          for (const tr of event.toolResults) {
            const output = JSON.stringify('result' in tr ? tr.result : tr.output)
            console.log(`[chat] TOOL RESULT: ${tr.toolName} → ${output.slice(0, 300)}`)
          }
        }

        if (event.usage) {
          console.log(`[chat] TOKENS: ${event.usage.inputTokens} in / ${event.usage.outputTokens} out`)
        }

        // Persist assistant messages (fire-and-forget)
        if (conversationId) {
          if (event.text) {
            addMessage(supabase, {
              conversationId,
              role: 'assistant',
              content: event.text,
              toolCalls: event.toolCalls?.length ? (event.toolCalls as unknown as Json) : undefined,
            }).catch(err => console.error('[chat] PERSIST ASSISTANT MSG FAILED:', err))
          }
          if (event.toolResults?.length) {
            addMessage(supabase, {
              conversationId,
              role: 'tool',
              content: null,
              toolCalls: event.toolResults as unknown as Json,
            }).catch(err => console.error('[chat] PERSIST TOOL RESULTS FAILED:', err))
          }
        }

        // Emit vault event on session end
        if (event.toolResults?.length) {
          for (const tr of event.toolResults) {
            if (tr.toolName === 'end_session' && 'result' in tr) {
              console.log('[chat] SESSION ENDED via tool — emitting to vault')
              if (sessionId) {
                getSessionDetail(supabase, sessionId).then(({ data: detail }) => {
                  if (!detail) {
                    console.error('[vault] no session detail found for:', sessionId)
                    return
                  }
                  const exercises = [...new Set(
                    (detail.session_sets ?? []).map((s: Record<string, unknown>) =>
                      (s.exercises as Record<string, string> | null)?.name ?? 'Unknown'
                    )
                  )]
                  const durationMin = detail.ended_at
                    ? Math.round((new Date(detail.ended_at).getTime() - new Date(detail.started_at).getTime()) / 60000)
                    : 0
                  console.log(`[vault] emitting: ${exercises.length} exercises, ${(detail.session_sets ?? []).length} sets, ${durationMin}min`)
                  emitToVault({
                    type: 'gym_session',
                    date: detail.started_at,
                    duration_min: durationMin,
                    exercises: exercises as string[],
                    total_sets: (detail.session_sets ?? []).length,
                    summary: `${exercises.length} exercises, ${(detail.session_sets ?? []).length} sets, ${durationMin}min`,
                    tags: ['gym', 'session'],
                  }).catch(err => console.error('[vault] EMIT FAILED:', err))
                }).catch(err => console.error('[vault] SESSION DETAIL FETCH FAILED:', err))
              }
            }
          }
        }
      },
      onFinish: async ({ usage }) => {
        console.log(`[chat] ========== FINISHED (model: ${modelId}) ==========`)
        if (usage) {
          const cost = estimateCost(modelId, usage.inputTokens ?? 0, usage.outputTokens ?? 0)
          console.log(`[chat] TOTAL: ${usage.inputTokens} in / ${usage.outputTokens} out | cost: $${cost.toFixed(6)}`)
          await supabase.from('ai_usage').insert({
            user_id: user.id,
            model: modelId,
            task_type: 'in_session',
            tokens_in: usage.inputTokens ?? 0,
            tokens_out: usage.outputTokens ?? 0,
            estimated_cost: cost,
          })
        }
      },
      onError: ({ error }) => {
        console.error(`[chat] ❌ STREAM ERROR (model: ${modelId}):`, error)
      },
    })

    const response = result.toUIMessageStreamResponse()
    if (conversationId) {
      response.headers.set('X-Conversation-Id', conversationId)
    }
    response.headers.set('X-Model-Id', modelId)
    return response
  } catch (error) {
    console.error('[chat] ❌ UNHANDLED ERROR:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
