import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { searchExercises, getExerciseHistory } from '@/lib/db/exercises'
import { getEquipment } from '@/lib/db/equipment'

type Supabase = SupabaseClient<Database, 'gym'>

export function createFreeChatTools(supabase: Supabase, userId: string) {
  return {
    record_check_in: tool({
      description: 'Record a body check-in — soreness, energy, sleep quality. Use when the user mentions soreness, fatigue, or recovery. Infer values from conversation.',
      inputSchema: z.object({
        check_in_date: z.string().describe('ISO date string for the check-in (default today)'),
        soreness_map: z.record(z.string(), z.number().min(1).max(5))
          .describe('Muscle group name → soreness level 1-5. e.g. {"chest": 3, "shoulders": 2}'),
        energy: z.number().min(1).max(5).optional().describe('Overall energy level 1-5, inferred from conversation'),
        sleep_quality: z.number().min(1).max(5).optional().describe('Sleep quality 1-5, if mentioned'),
        notes: z.string().optional().describe('Free text notes about how they feel'),
      }),
      execute: async (input) => {
        const { data, error } = await supabase.from('body_check_ins').insert({
          user_id: userId,
          check_in_date: input.check_in_date,
          soreness_map: input.soreness_map,
          energy: input.energy ?? null,
          sleep_quality: input.sleep_quality ?? null,
          notes: input.notes ?? null,
        }).select().single()
        if (error) return { error: error.message }
        return { checkInId: data.id, message: 'Check-in recorded' }
      },
    }),

    get_exercise_history: tool({
      description: 'Get recent history for a specific exercise. Use to answer questions about past performance.',
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
        muscle_group_id: z.number().int().optional(),
        equipment_type: z.enum(['machine', 'free_weight', 'cable', 'bodyweight', 'cardio']).optional(),
        movement_type: z.enum(['compound', 'isolation']).optional(),
        query: z.string().optional(),
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
      description: 'List equipment available at the gym.',
      inputSchema: z.object({
        gym_id: z.string().uuid(),
      }),
      execute: async (input) => {
        const { data, error } = await getEquipment(supabase, input.gym_id)
        if (error) return { error: error.message }
        return { equipment: data }
      },
    }),
  }
}
