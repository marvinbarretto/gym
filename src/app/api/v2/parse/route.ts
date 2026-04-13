import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveExercise } from '@/lib/ai/exercise-resolver'
import type { ParsedEntry } from '@/lib/ai/response-parser'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const { sessionId, entries }: { sessionId: string; entries: ParsedEntry[] } = await request.json()
  console.log('[parse] sessionId:', sessionId, '| entries:', entries.length)

  if (!sessionId || !entries.length) {
    return Response.json({ saved: [], errors: ['Missing sessionId or entries'] }, { status: 400 })
  }

  // Load exercise list for name resolution
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name')
    .order('name')
    .limit(200)

  if (!exercises) {
    return Response.json({ saved: [], errors: ['Failed to load exercises'] }, { status: 500 })
  }

  const saved: Array<{ type: string; id: string; exercise_name: string; data: Record<string, unknown> }> = []
  const errors: string[] = []

  for (const entry of entries) {
    const resolved = resolveExercise(entry.exercise, exercises)

    if (resolved.match === 'none') {
      errors.push(`Unknown exercise: "${entry.exercise}"`)
      continue
    }

    if (resolved.match === 'ambiguous') {
      const names = resolved.candidates!.map(c => c.name).join(', ')
      errors.push(`Ambiguous exercise "${entry.exercise}" — could be: ${names}`)
      continue
    }

    const exerciseId = resolved.exercise!.id
    const exerciseName = resolved.exercise!.name

    if (entry.type === 'log_sets') {
      const { data: existingSets } = await supabase
        .from('session_sets')
        .select('set_number')
        .eq('session_id', sessionId)
        .eq('exercise_id', exerciseId)
        .order('set_number', { ascending: false })
        .limit(1)

      let nextSetNumber = (existingSets?.[0]?.set_number ?? 0) + 1

      for (const setData of entry.sets) {
        const { data: row, error } = await supabase.from('session_sets').insert({
          session_id: sessionId,
          exercise_id: exerciseId,
          set_number: nextSetNumber,
          reps: setData.reps ?? null,
          weight_kg: setData.weight_kg ?? null,
          rpe: setData.rpe ?? null,
          duration_s: setData.duration_s ?? null,
          notes: setData.notes ?? null,
        }).select().single()

        if (error) {
          console.error('[parse] insert set failed:', error.message)
          errors.push(`Failed to save set: ${error.message}`)
        } else {
          saved.push({ type: 'set', id: row.id, exercise_name: exerciseName, data: { ...row, exercise_name: exerciseName } })
        }
        nextSetNumber++
      }
    } else if (entry.type === 'log_cardio') {
      const { data: row, error } = await supabase.from('session_cardio').insert({
        session_id: sessionId,
        exercise_id: exerciseId,
        duration_s: entry.duration_min * 60,
        distance_km: entry.distance_km ?? null,
        notes: entry.notes ?? null,
      }).select().single()

      if (error) {
        console.error('[parse] insert cardio failed:', error.message)
        errors.push(`Failed to save cardio: ${error.message}`)
      } else {
        saved.push({ type: 'cardio', id: row.id, exercise_name: exerciseName, data: { ...row, exercise_name: exerciseName } })
      }
    }
  }

  console.log('[parse] saved:', saved.length, '| errors:', errors.length)
  return Response.json({ saved, errors })
}
