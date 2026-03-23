import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

export async function searchExercises(supabase: Supabase, filters: {
  muscleGroupId?: number
  equipmentType?: string
  movementType?: string
  query?: string
}) {
  let q = supabase.from('exercises').select('*, muscle_groups!exercises_primary_muscle_group_fkey(name)')

  if (filters.muscleGroupId) {
    q = q.eq('primary_muscle_group', filters.muscleGroupId)
  }
  if (filters.equipmentType) {
    q = q.eq('equipment_type', filters.equipmentType)
  }
  if (filters.movementType) {
    q = q.eq('movement_type', filters.movementType)
  }
  if (filters.query) {
    q = q.ilike('name', `%${filters.query}%`)
  }

  return q.order('name').limit(20)
}

export async function getExerciseHistory(supabase: Supabase, exerciseId: string, limit = 20) {
  return supabase.from('session_sets')
    .select('*, sessions(started_at)')
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false })
    .limit(limit)
}
