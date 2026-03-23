import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>
import { createSession, endSession, logSet, logCardio } from '@/lib/db/sessions'
import { searchExercises, getExerciseHistory } from '@/lib/db/exercises'
import { getEquipment, addEquipment } from '@/lib/db/equipment'

export function createGymTools(supabase: Supabase, userId: string) {
  return {
    start_session: tool({
      description: 'Start a new gym session. Call this when the user arrives at the gym or wants to begin/log a workout. For past sessions, set started_at to the date/time.',
      inputSchema: z.object({
        gym_id: z.string().uuid().optional().describe('The gym where the session is taking place'),
        plan_day_id: z.string().uuid().optional().describe('The plan day to follow, if any'),
        pre_energy: z.number().min(1).max(5).optional().describe('Pre-session energy level, inferred from conversation'),
        pre_mood: z.string().optional().describe('Pre-session mood description'),
        started_at: z.string().optional().describe('ISO timestamp for when the session started. Use for retrospective logging of past sessions. Omit to use current time.'),
      }),
      execute: async (input) => {
        const { data, error } = await createSession(supabase, {
          userId,
          gymId: input.gym_id,
          planDayId: input.plan_day_id,
          preEnergy: input.pre_energy,
          preMood: input.pre_mood,
          startedAt: input.started_at,
        })
        if (error) return { error: error.message }
        return { sessionId: data.id, message: 'Session started' }
      },
    }),

    log_set: tool({
      description: 'Log a single set of an exercise. Call after the user reports completing a set.',
      inputSchema: z.object({
        session_id: z.string().uuid().describe('Current session ID'),
        exercise_id: z.string().uuid().describe('The exercise performed'),
        set_number: z.number().int().min(1).describe('Which set number (1, 2, 3...)'),
        reps: z.number().int().min(0).optional().describe('Number of reps completed'),
        weight_kg: z.number().min(0).optional().describe('Weight used in kg'),
        rpe: z.number().int().min(1).max(10).optional().describe('Rate of Perceived Exertion, inferred from user description'),
        duration_s: z.number().int().optional().describe('Duration in seconds for timed exercises like planks'),
        notes: z.string().optional().describe('Any notes about this set'),
      }),
      execute: async (input) => {
        const { data, error } = await logSet(supabase, {
          sessionId: input.session_id,
          exerciseId: input.exercise_id,
          setNumber: input.set_number,
          reps: input.reps,
          weightKg: input.weight_kg,
          rpe: input.rpe,
          durationS: input.duration_s,
          notes: input.notes,
        })
        if (error) return { error: error.message }
        return { setId: data.id, message: `Set ${input.set_number} logged` }
      },
    }),

    log_cardio: tool({
      description: 'Log a cardio exercise (treadmill, bike, rowing, etc).',
      inputSchema: z.object({
        session_id: z.string().uuid().describe('Current session ID'),
        exercise_id: z.string().uuid().describe('The cardio exercise performed'),
        duration_s: z.number().int().min(0).describe('How long in seconds'),
        distance_km: z.number().min(0).optional().describe('Distance covered in km'),
        avg_heart_rate: z.number().int().optional().describe('Average heart rate'),
        notes: z.string().optional(),
      }),
      execute: async (input) => {
        const { data, error } = await logCardio(supabase, {
          sessionId: input.session_id,
          exerciseId: input.exercise_id,
          durationS: input.duration_s,
          distanceKm: input.distance_km,
          avgHeartRate: input.avg_heart_rate,
          notes: input.notes,
        })
        if (error) return { error: error.message }
        return { cardioId: data.id, message: 'Cardio logged' }
      },
    }),

    end_session: tool({
      description: 'End the current gym session. For past sessions, set ended_at to when it finished.',
      inputSchema: z.object({
        session_id: z.string().uuid().describe('Session to end'),
        notes: z.string().optional().describe('Overall session notes'),
        ended_at: z.string().optional().describe('ISO timestamp for when the session ended. Use for retrospective logging. Omit to use current time.'),
      }),
      execute: async (input) => {
        const { data, error } = await endSession(supabase, input.session_id, input.notes, input.ended_at)
        if (error) return { error: error.message }
        return { message: 'Session ended', endedAt: data.ended_at }
      },
    }),

    get_todays_plan: tool({
      description: 'Get the workout plan for today. Checks the active plan and returns prescribed exercises.',
      inputSchema: z.object({
        plan_id: z.string().uuid().optional().describe('Specific plan ID. If omitted, uses the active plan.'),
      }),
      execute: async (input) => {
        let planQuery = supabase.from('plans')
          .select('*, plan_days(*, plan_day_exercises(*, exercises(name, description, equipment_type)).limit(20)).limit(10)')

        if (input.plan_id) {
          planQuery = planQuery.eq('id', input.plan_id)
        } else {
          planQuery = planQuery.eq('user_id', userId).eq('is_active', true)
        }

        const { data, error } = await planQuery.single()
        if (error) return { error: error.message, message: 'No active plan found' }
        return { plan: data }
      },
    }),

    get_exercise_history: tool({
      description: 'Get recent history for a specific exercise. Use to suggest weights based on past performance.',
      inputSchema: z.object({
        exercise_id: z.string().uuid().describe('Exercise to look up'),
      }),
      execute: async (input) => {
        const { data, error } = await getExerciseHistory(supabase, input.exercise_id)
        if (error) return { error: error.message }
        return { sets: data }
      },
    }),

    search_exercises: tool({
      description: 'Search for exercises by muscle group, equipment type, movement type, or name.',
      inputSchema: z.object({
        muscle_group_id: z.number().int().optional().describe('Muscle group ID (smallint)'),
        equipment_type: z.enum(['machine', 'free_weight', 'cable', 'bodyweight', 'cardio']).optional(),
        movement_type: z.enum(['compound', 'isolation']).optional(),
        query: z.string().optional().describe('Search by name'),
      }),
      execute: async (input) => {
        const { data, error } = await searchExercises(supabase, {
          muscleGroupId: input.muscle_group_id,
          equipmentType: input.equipment_type,
          movementType: input.movement_type,
          query: input.query,
        })
        if (error) return { error: error.message }
        return { exercises: data }
      },
    }),

    get_equipment: tool({
      description: 'List equipment available at the current gym.',
      inputSchema: z.object({
        gym_id: z.string().uuid().describe('Gym to list equipment for'),
      }),
      execute: async (input) => {
        const { data, error } = await getEquipment(supabase, input.gym_id)
        if (error) return { error: error.message }
        return { equipment: data }
      },
    }),

    add_equipment: tool({
      description: 'Add a new piece of equipment to the gym. Use when the user describes a machine not in the equipment list.',
      inputSchema: z.object({
        gym_id: z.string().uuid(),
        name: z.string().describe('Equipment name'),
        type: z.enum(['machine', 'free_weight', 'cable', 'bodyweight', 'cardio']),
        description: z.string().optional().describe('What it looks like or does'),
      }),
      execute: async (input) => {
        const { data, error } = await addEquipment(supabase, {
          gymId: input.gym_id,
          name: input.name,
          type: input.type,
          description: input.description,
        })
        if (error) return { error: error.message }
        return { equipmentId: data.id, message: `Added ${input.name}` }
      },
    }),
  }
}
