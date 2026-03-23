import type { SupabaseClient } from '@supabase/supabase-js'

export async function searchExercises(supabase: SupabaseClient, filters: {
  muscleGroupId?: string
  equipmentType?: string
  movementType?: string
  query?: string
}) {
  let q = supabase.from('exercises').select('*, muscle_groups!exercises_primary_muscle_group_id_fkey(name)')

  if (filters.muscleGroupId) {
    q = q.eq('primary_muscle_group_id', filters.muscleGroupId)
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

export async function getExerciseHistory(supabase: SupabaseClient, exerciseId: string, limit = 20) {
  return supabase.from('session_sets')
    .select('*, sessions(started_at)')
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false })
    .limit(limit)
}
