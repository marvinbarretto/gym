import type { SupabaseClient } from '@supabase/supabase-js'

export async function getEquipment(supabase: SupabaseClient, gymId: string) {
  return supabase.from('equipment')
    .select('*')
    .eq('gym_id', gymId)
    .order('name')
    .limit(100)
}

export async function addEquipment(supabase: SupabaseClient, data: {
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
