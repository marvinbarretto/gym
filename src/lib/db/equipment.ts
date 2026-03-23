import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

export async function getEquipment(supabase: Supabase, gymId: string) {
  return supabase.from('equipment')
    .select('*')
    .eq('gym_id', gymId)
    .order('name')
    .limit(100)
}

export async function addEquipment(supabase: Supabase, data: {
  gymId: string
  name: string
  type: 'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio'
  description?: string
}) {
  return supabase.from('equipment').insert({
    gym_id: data.gymId,
    name: data.name,
    type: data.type,
    description: data.description ?? null,
  }).select().single()
}
