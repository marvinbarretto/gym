import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

type ConversationType = 'session' | 'check_in' | 'planning' | 'question'

export function buildCreateConversation(data: {
  userId: string
  type: ConversationType
  sessionId?: string
}) {
  return {
    user_id: data.userId,
    type: data.type,
    session_id: data.sessionId ?? null,
  }
}

export function buildAddMessage(data: {
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  toolCalls?: Json
}) {
  return {
    conversation_id: data.conversationId,
    role: data.role,
    content: data.content,
    tool_calls: data.toolCalls ?? undefined,
  }
}

export async function createConversation(supabase: Supabase, data: {
  userId: string
  type: ConversationType
  sessionId?: string
}) {
  return supabase.from('conversations')
    .insert(buildCreateConversation(data))
    .select()
    .single()
}

export async function addMessage(supabase: Supabase, data: {
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  toolCalls?: Json
}) {
  return supabase.from('conversation_messages')
    .insert(buildAddMessage(data))
    .select()
    .single()
}

export async function getConversation(supabase: Supabase, conversationId: string) {
  return supabase.from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()
}

export async function getConversationBySession(supabase: Supabase, sessionId: string) {
  return supabase.from('conversations')
    .select('*')
    .eq('session_id', sessionId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
}

export async function getMessages(supabase: Supabase, conversationId: string) {
  return supabase.from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500)
}

export async function getOpenSession(supabase: Supabase, userId: string) {
  return supabase.from('sessions')
    .select('id, started_at, gym_id, user_gyms(name)')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

export async function endConversation(supabase: Supabase, conversationId: string) {
  return supabase.from('conversations')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', conversationId)
}
