import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

export async function updateSet(supabase: Supabase, setId: string, data: {
  exerciseId?: string
  reps?: number | null
  weightKg?: number | null
  rpe?: number | null
}) {
  const update: Record<string, unknown> = {}
  if (data.exerciseId !== undefined) update.exercise_id = data.exerciseId
  if (data.reps !== undefined) update.reps = data.reps
  if (data.weightKg !== undefined) update.weight_kg = data.weightKg
  if (data.rpe !== undefined) update.rpe = data.rpe

  return supabase.from('session_sets')
    .update(update)
    .eq('id', setId)
    .select()
    .single()
}

export async function deleteSet(supabase: Supabase, setId: string) {
  return supabase.from('session_sets')
    .delete()
    .eq('id', setId)
}
