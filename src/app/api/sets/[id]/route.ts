import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateSet, deleteSet } from '@/lib/db/sets'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await request.json()
  const { data, error } = await updateSet(supabase, id, body)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ set: data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { error } = await deleteSet(supabase, id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
