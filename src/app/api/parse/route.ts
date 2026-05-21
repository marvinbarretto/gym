import { exercises, sets, cardio, sessions } from '@/lib/api/jimbo-client'
import { resolveExercise } from '@/lib/ai/exercise-resolver'
import type { ParsedEntry } from '@/lib/ai/response-parser'

export async function POST(request: Request) {
  const { sessionId, entries }: { sessionId: string; entries: ParsedEntry[] } = await request.json()
  console.log('[parse] sessionId:', sessionId, '| entries:', entries.length)

  if (!sessionId || !entries.length) {
    return Response.json({ saved: [], errors: ['Missing sessionId or entries'] }, { status: 400 })
  }

  const catalogue = await exercises.search({ limit: 100 })
  if (!catalogue.length) {
    return Response.json({ saved: [], errors: ['Failed to load exercises'] }, { status: 500 })
  }

  // jimbo-api stores set_number explicitly per row. We need the next available
  // set_number per exercise; pull the session detail once and seed a counter.
  const detail = await sessions.detail(sessionId)
  const setCounters = new Map<string, number>()
  for (const s of detail.sets) {
    const cur = setCounters.get(s.exercise_id) ?? 0
    if (s.set_number > cur) setCounters.set(s.exercise_id, s.set_number)
  }

  const saved: Array<{ type: string; id: string; exercise_name: string; data: Record<string, unknown> }> = []
  const errors: string[] = []

  for (const entry of entries) {
    const resolved = resolveExercise(entry.exercise, catalogue)

    if (resolved.match === 'none') {
      errors.push(`Unknown exercise: "${entry.exercise}"`)
      continue
    }
    if (resolved.match === 'ambiguous') {
      const names = resolved.candidates!.map((c) => c.name).join(', ')
      errors.push(`Ambiguous exercise "${entry.exercise}" — could be: ${names}`)
      continue
    }

    const exerciseId = resolved.exercise!.id
    const exerciseName = resolved.exercise!.name

    if (entry.type === 'log_sets') {
      for (const setData of entry.sets) {
        const nextSetNumber = (setCounters.get(exerciseId) ?? 0) + 1
        setCounters.set(exerciseId, nextSetNumber)
        try {
          const row = await sets.create(sessionId, {
            exercise_id: exerciseId,
            set_number: nextSetNumber,
            ...(setData.reps != null ? { reps: setData.reps } : {}),
            ...(setData.weight_kg != null ? { weight_kg: setData.weight_kg } : {}),
            ...(setData.rpe != null ? { rpe: setData.rpe } : {}),
            ...(setData.duration_s != null ? { duration_s: setData.duration_s } : {}),
            ...(setData.notes ? { notes: setData.notes } : {}),
          })
          saved.push({ type: 'set', id: row.id, exercise_name: exerciseName, data: { ...row, exercise_name: exerciseName } })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown'
          console.error('[parse] insert set failed:', msg)
          errors.push(`Failed to save set: ${msg}`)
        }
      }
    } else if (entry.type === 'log_cardio') {
      try {
        const row = await cardio.create(sessionId, {
          exercise_id: exerciseId,
          duration_s: entry.duration_min * 60,
          ...(entry.distance_km != null ? { distance_km: entry.distance_km } : {}),
          ...(entry.notes ? { notes: entry.notes } : {}),
        })
        saved.push({ type: 'cardio', id: row.id, exercise_name: exerciseName, data: { ...row, exercise_name: exerciseName } })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        console.error('[parse] insert cardio failed:', msg)
        errors.push(`Failed to save cardio: ${msg}`)
      }
    }
  }

  console.log('[parse] saved:', saved.length, '| errors:', errors.length)
  return Response.json({ saved, errors })
}
