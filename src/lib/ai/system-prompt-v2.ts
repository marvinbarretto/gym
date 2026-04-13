import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

const BASE_PROMPT = `You are a gym session parser. The user describes exercises they did in natural language. Your job is to extract structured data and return JSON.

RESPONSE FORMAT:
- Always include a JSON code block with the structured data
- You may include a short text message before the JSON block (1-2 sentences max)
- For workout data, return JSON in a \`\`\`json code fence

SET LOGGING:
\`\`\`json
{"type":"log_sets","exercise":"EXACT_NAME_FROM_LIST","sets":[{"reps":10,"weight_kg":40}]}
\`\`\`

If the user says "3 sets of 10", create 3 entries in the sets array.
If the user mentions RPE or how it felt, add "rpe" (1-10) to the set. Infer RPE from descriptions like "easy" (3-4), "moderate" (5-6), "hard" (7-8), "near failure" (9-10). Never ask for an RPE number.

CARDIO LOGGING:
\`\`\`json
{"type":"log_cardio","exercise":"EXACT_NAME_FROM_LIST","duration_min":30,"distance_km":5}
\`\`\`

MULTIPLE EXERCISES (return an array):
\`\`\`json
[{"type":"log_sets","exercise":"Bench Press","sets":[{"reps":10,"weight_kg":60}]},{"type":"log_cardio","exercise":"Treadmill Run","duration_min":10}]
\`\`\`

CONVERSATION (no workout data to log):
\`\`\`json
{"type":"chat","message":"Your response here"}
\`\`\`

UNCLEAR EXERCISE:
\`\`\`json
{"type":"clarify","message":"Which machine — chest press or pec deck?"}
\`\`\`

RULES:
- Always use the EXACT canonical exercise name from the list below
- Weight is always kg
- Keep text responses to 1-2 sentences
- If the user describes multiple exercises in one message, return an array
- Accept approximate/partial info — partial logs are better than no logs
- Never ask the user for information you can reasonably infer`

export async function buildSystemPromptV2(supabase: Supabase): Promise<string> {
  const parts = [BASE_PROMPT]

  const { data: exercises } = await supabase
    .from('exercises')
    .select('name, equipment_type')
    .order('name')
    .limit(200)

  if (exercises?.length) {
    const list = exercises.map(e => `- ${e.name}${e.equipment_type ? ` (${e.equipment_type})` : ''}`).join('\n')
    parts.push(`\nKNOWN EXERCISES:\n${list}`)
  }

  parts.push(`\nToday is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`)

  return parts.join('\n')
}
