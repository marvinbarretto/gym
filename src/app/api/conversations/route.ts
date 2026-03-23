import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getMessages, getConversationBySession } from '@/lib/db/conversations'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('[conversations] unauthorized request')
      return new Response('Unauthorized', { status: 401 })
    }

    const url = new URL(request.url)
    const conversationId = url.searchParams.get('conversationId')
    const sessionId = url.searchParams.get('sessionId')

    console.log('[conversations] GET', { conversationId, sessionId, userId: user.id })

    if (conversationId) {
      const { data, error } = await getMessages(supabase, conversationId)
      if (error) {
        console.error('[conversations] getMessages error:', error.message)
        return Response.json({ error: error.message }, { status: 500 })
      }
      return Response.json({ messages: data })
    }

    if (sessionId) {
      const { data: conv } = await getConversationBySession(supabase, sessionId)
      if (conv) {
        const { data: msgs } = await getMessages(supabase, conv.id)
        return Response.json({ conversationId: conv.id, messages: msgs ?? [] })
      }
      return Response.json({ conversationId: null, messages: [] })
    }

    return Response.json({ messages: [] })
  } catch (error) {
    console.error('[conversations] unhandled error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
