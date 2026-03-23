import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

export async function createSession(supabase: Supabase, data: {
  userId: string
  gymId?: string
  planDayId?: string
  preEnergy?: number
  preMood?: string
}) {
  return supabase.from('sessions').insert({
    user_id: data.userId,
    gym_id: data.gymId ?? null,
    plan_day_id: data.planDayId ?? null,
    pre_energy: data.preEnergy ?? null,
    pre_mood: data.preMood ?? null,
  }).select().single()
}

export async function endSession(supabase: Supabase, sessionId: string, notes?: string) {
  return supabase.from('sessions').update({
    ended_at: new Date().toISOString(),
    notes: notes ?? null,
  }).eq('id', sessionId).select().single()
}

export async function logSet(supabase: Supabase, data: {
  sessionId: string
  exerciseId: string
  setNumber: number
  reps?: number
  weightKg?: number
  rpe?: number
  durationS?: number
  notes?: string
}) {
  return supabase.from('session_sets').insert({
    session_id: data.sessionId,
    exercise_id: data.exerciseId,
    set_number: data.setNumber,
    reps: data.reps ?? null,
    weight_kg: data.weightKg ?? null,
    rpe: data.rpe ?? null,
    duration_s: data.durationS ?? null,
    notes: data.notes ?? null,
  }).select().single()
}

export async function logCardio(supabase: Supabase, data: {
  sessionId: string
  exerciseId: string
  durationS: number
  distanceKm?: number
  avgHeartRate?: number
  notes?: string
}) {
  return supabase.from('session_cardio').insert({
    session_id: data.sessionId,
    exercise_id: data.exerciseId,
    duration_s: data.durationS,
    distance_km: data.distanceKm ?? null,
    avg_heart_rate: data.avgHeartRate ?? null,
    notes: data.notes ?? null,
  }).select().single()
}

export async function getRecentSessions(supabase: Supabase, userId: string, limit = 10) {
  return supabase.from('sessions')
    .select('*, session_sets(*, exercises(name)).limit(50), session_cardio(*).limit(20)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)
}

export async function getSessionDetail(supabase: Supabase, sessionId: string) {
  return supabase.from('sessions')
    .select('*, session_sets(*, exercises(name, primary_muscle_group)).limit(100), session_cardio(*, exercises(name)).limit(20), user_gyms(name)')
    .eq('id', sessionId)
    .single()
}
