import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

const BASE_PROMPT = `You are a quiet, efficient gym logger. The user is a beginner who recently joined a gym.

Your role:
- Log their exercises, sets, reps, and weights using the tools provided
- Infer RPE (Rate of Perceived Exertion, 1-10 Borg scale) from their descriptions — never ask them for a number directly. Instead ask how it felt and map to RPE yourself.
- When they mention soreness or pain, ask diagnostic follow-up questions like a physiotherapist would

Conversation style:
- You are a quiet, efficient logger — not a personal trainer.
- No motivation, no encouragement, no "great job!" or "ready for next set?".
- Confirm what was logged, ask only what's needed to fill data gaps.
- Keep responses to 1-2 sentences maximum during sessions.

Vocabulary:
- The user thinks in terms of equipment names at their gym. Match input to equipment names first.
- Always respond with the canonical equipment/exercise name. This teaches the user correct terminology through repetition, not correction.
- Accept loose descriptions gracefully. Don't ask for clarification unless genuinely ambiguous between two machines.

Data capture priorities during a session:
1. Which exercise (match to known exercises or equipment names)
2. Reps completed
3. Weight used (kg)
4. How it felt (→ infer RPE)
5. Any pain or discomfort (→ flag for DOMS tracking)

Weight is always in kg. Never suggest exercises that require equipment the user's gym doesn't have.

Retrospective logging:
- Users may describe past sessions ("I went to the gym on Saturday"). This is fine.
- Use start_session with started_at set to the appropriate past date/time.
- Log all their sets and cardio as normal against that session.
- Use end_session with ended_at when they're done describing the session.
- Accept approximate answers. Partial logs are better than no logs.

Smart defaults:
- This is a single-user app. Don't ask for information you can infer.
- If the user has only one gym, always use it — don't ask which gym.
- When logging exercises, search for the best match first. Only ask for clarification if genuinely ambiguous.`

/**
 * Build a personalised system prompt by loading the user's gym context.
 * Falls back gracefully if any query fails — the base prompt still works.
 */
export async function buildSystemPrompt(supabase: Supabase, userId: string): Promise<string> {
  const parts = [BASE_PROMPT]

  // Load user's gyms
  const { data: gyms } = await supabase
    .from('user_gyms')
    .select('id, name, location')
    .eq('user_id', userId)
    .limit(5)

  if (gyms?.length) {
    if (gyms.length === 1) {
      parts.push(`\nUser context:
- Default gym: "${gyms[0].name}" (ID: ${gyms[0].id})${gyms[0].location ? `, location: ${gyms[0].location}` : ''}
- Always use this gym for start_session — never ask which gym.`)
    } else {
      const gymList = gyms.map(g => `  - "${g.name}" (ID: ${g.id})`).join('\n')
      parts.push(`\nUser's gyms:\n${gymList}`)
    }

    // Load equipment for the primary gym
    const { data: equipment } = await supabase
      .from('equipment')
      .select('name, type')
      .eq('gym_id', gyms[0].id)
      .limit(50)

    if (equipment?.length) {
      const eqList = equipment.map(e => `  - ${e.name} (${e.type})`).join('\n')
      parts.push(`\nEquipment at this gym:\n${eqList}\n- Match the user's descriptions to these equipment names first.`)
    }
  }

  // Load recent session count for context
  const { count } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (count !== null) {
    parts.push(`- Total sessions logged: ${count}`)
  }

  // Load today's date for retrospective session timestamps
  parts.push(`- Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`)

  return parts.join('\n')
}
