import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DEFAULT_MODEL_CONFIG } from '@/lib/ai/model-router'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase.from('model_config').select('config').eq('user_id', user.id).single()
  return NextResponse.json(data?.config ?? DEFAULT_MODEL_CONFIG)
}

export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const config = await request.json()
  const { error } = await supabase.from('model_config').upsert({
    user_id: user.id,
    config,
    updated_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
