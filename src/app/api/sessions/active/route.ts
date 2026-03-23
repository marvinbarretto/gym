import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOpenSession } from '@/lib/db/conversations'
import { createSession, endSession } from '@/lib/db/sessions'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await getOpenSession(supabase, user.id)
  return Response.json({ session: data })
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Auto-select the user's only gym
  const { data: gyms } = await supabase
    .from('user_gyms')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  const gymId = gyms?.[0]?.id ?? undefined

  const { data, error } = await createSession(supabase, {
    userId: user.id,
    gymId,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ session: data })
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { action, sessionId } = await request.json()
  if (action === 'end' && sessionId) {
    const { data, error } = await endSession(supabase, sessionId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ session: data })
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 })
}
