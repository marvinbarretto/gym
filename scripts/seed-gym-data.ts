/**
 * Seed personal gym data into the gym schema.
 *
 * Usage:
 *   npx tsx scripts/seed-gym-data.ts                    # dry-run (default)
 *   npx tsx scripts/seed-gym-data.ts --live <user-id>   # write to Supabase
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS).
 * NEXT_PUBLIC_SUPABASE_URL must also be present in .env.local.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  let raw: string
  try {
    raw = readFileSync(envPath, 'utf-8')
  } catch {
    console.warn('Warning: .env.local not found — falling back to process.env')
    return
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

function parseArgs(): { live: boolean; userId: string | null } {
  const args = process.argv.slice(2)
  const live = args.includes('--live')
  const liveIdx = args.indexOf('--live')
  const userId = live && liveIdx + 1 < args.length ? args[liveIdx + 1] : null
  return { live, userId }
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const GYM_DATA = {
  name: 'Gym Location',
  location: 'Watford',
  notes: 'Newest gym in town, joined March 2026, two floors of equipment',
}

const EQUIPMENT_DATA: Array<{ name: string; type: 'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio'; description?: string }> = [
  // Free weights
  { name: 'Dumbbells',                    type: 'free_weight' },
  { name: 'Olympic Barbells',             type: 'free_weight' },
  { name: 'EZ-Curl Bars',                 type: 'free_weight' },
  { name: 'Flat Benches',                 type: 'free_weight' },
  { name: 'Adjustable Incline Benches',   type: 'free_weight' },
  { name: 'Decline Bench',                type: 'free_weight' },
  { name: 'Squat Rack',                   type: 'free_weight' },
  // Machines
  { name: 'Smith Machine',                type: 'machine' },
  { name: 'Plate-Loaded Leg Press',       type: 'machine' },
  { name: 'Plate-Loaded Hack Squat',      type: 'machine' },
  { name: 'Chest Press Machine',          type: 'machine' },
  { name: 'Shoulder Press Machine',       type: 'machine' },
  { name: 'Pec Deck / Fly Machine',       type: 'machine' },
  { name: 'Leg Extension Machine',        type: 'machine' },
  { name: 'Seated Leg Curl Machine',      type: 'machine' },
  { name: 'Standing Leg Curl Machine',    type: 'machine' },
  { name: 'Hip Abductor / Adductor',      type: 'machine' },
  { name: 'Standing Calf Raise Machine',  type: 'machine' },
  { name: 'Tricep Extension Machine',     type: 'machine' },
  { name: 'Assisted Pull-Up / Dip Machine', type: 'machine' },
  { name: 'Ab Crunch Machine',            type: 'machine' },
  // Cable
  { name: 'Dual Adjustable Pulleys',      type: 'cable' },
  { name: 'Seated Cable Row Machine',     type: 'cable' },
  { name: 'Lat Pulldown',                 type: 'cable' },
  // Cardio
  { name: 'Treadmills',                   type: 'cardio' },
  { name: 'Stationary Bikes',             type: 'cardio' },
  { name: 'Rowing Machines',              type: 'cardio' },
  { name: 'Stairmaster',                  type: 'cardio' },
  { name: 'Elliptical / Cross Trainer',   type: 'cardio' },
  // Bodyweight
  { name: 'Pull-Up Bar',                  type: 'bodyweight' },
  { name: 'Dip Station',                  type: 'bodyweight' },
  { name: 'Roman Chair / Hyperextension', type: 'bodyweight' },
]

const SUPPLEMENTS_DATA: Array<{ name: string; type: 'protein' | 'creatine' | 'vitamin' | 'other'; dosage_unit: string }> = [
  { name: 'Vitamin D3 (Holland & Barrett, 25μg)', type: 'vitamin',  dosage_unit: 'tablet' },
  { name: 'Centrum Advance 50+ Multivitamin',     type: 'vitamin',  dosage_unit: 'tablet' },
  { name: 'Creatine Monohydrate (Bulk)',           type: 'creatine', dosage_unit: 'g'      },
  { name: 'Magnesium (375μg)',                     type: 'vitamin',  dosage_unit: 'tablet' },
  { name: 'ZMA',                                   type: 'other',    dosage_unit: 'tablet' },
]

// Flat strings for now — matches ModelConfig type in src/lib/ai/model-router.ts.
// Fallback routing (primary/fallback per tier) is a Phase 2 feature.
const MODEL_CONFIG = {
  in_session:    'anthropic/claude-haiku-4-5',
  post_session:  'anthropic/claude-sonnet-4-6',
  deep_analysis: 'opus-local',
  fallback:      'openrouter/google/gemini-2.5-flash-lite',
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvLocal()

  const { live, userId } = parseArgs()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Validate required env vars
  if (!supabaseUrl) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL is not set in .env.local')
    process.exit(1)
  }

  if (live && !serviceRoleKey) {
    console.error([
      'ERROR: SUPABASE_SERVICE_ROLE_KEY is not set.',
      '',
      'Add it to .env.local:',
      '  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>',
      '',
      'Find it in: Supabase Dashboard → Project Settings → API → service_role (secret)',
    ].join('\n'))
    process.exit(1)
  }

  if (live && !userId) {
    console.error([
      'ERROR: --live requires a user ID.',
      '',
      'Usage: npx tsx scripts/seed-gym-data.ts --live <user-id>',
    ].join('\n'))
    process.exit(1)
  }

  const mode = live ? 'LIVE' : 'DRY-RUN'
  console.log(`\n=== seed-gym-data [${mode}] ===\n`)

  if (!live) {
    console.log('Running in dry-run mode. Pass --live <user-id> to write data.\n')
  }

  // -------------------------------------------------------------------------
  // Preview what will be seeded
  // -------------------------------------------------------------------------

  console.log(`User ID:     ${live ? userId : '<user-id required for live>'}`)
  console.log(`Supabase URL: ${supabaseUrl}\n`)

  console.log('--- Gym ---')
  console.log(`  name:     ${GYM_DATA.name}`)
  console.log(`  location: ${GYM_DATA.location}`)
  console.log(`  notes:    ${GYM_DATA.notes}`)

  console.log('\n--- Equipment ---')
  for (const eq of EQUIPMENT_DATA) {
    console.log(`  [${eq.type.padEnd(12)}]  ${eq.name}`)
  }

  console.log('\n--- Supplements ---')
  for (const s of SUPPLEMENTS_DATA) {
    console.log(`  [${s.type.padEnd(10)}]  ${s.name}  (unit: ${s.dosage_unit})`)
  }

  console.log('\n--- Model Config ---')
  for (const [role, modelId] of Object.entries(MODEL_CONFIG)) {
    console.log(`  ${role.padEnd(16)} ${modelId}`)
  }

  if (!live) {
    console.log('\n[dry-run] No data written. Rerun with --live <user-id> to apply.\n')
    return
  }

  // -------------------------------------------------------------------------
  // Live writes
  // -------------------------------------------------------------------------

  // Both validated above with early exit — safe to assert non-null
  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    db: { schema: 'gym' },
  })

  // 1. Insert gym
  console.log('\n--- Writing ---')
  const { data: gymRow, error: gymErr } = await supabase
    .from('user_gyms')
    .insert({ user_id: userId!, ...GYM_DATA })
    .select('id')
    .single()

  if (gymErr) {
    console.error('ERROR inserting gym:', gymErr.message)
    process.exit(1)
  }
  console.log(`[ok] gym created: ${gymRow.id}`)

  // 2. Insert equipment
  const equipmentRows = EQUIPMENT_DATA.map(eq => ({ gym_id: gymRow.id, ...eq }))
  const { data: eqData, error: eqErr } = await supabase
    .from('equipment')
    .insert(equipmentRows)
    .select('id, name')

  if (eqErr) {
    console.error('ERROR inserting equipment:', eqErr.message)
    process.exit(1)
  }
  console.log(`[ok] equipment created: ${eqData.length} items`)
  for (const eq of eqData) {
    console.log(`     ${eq.id}  ${eq.name}`)
  }

  // 3. Insert supplements
  const supplementRows = SUPPLEMENTS_DATA.map(s => ({ user_id: userId!, ...s }))
  const { data: suppData, error: suppErr } = await supabase
    .from('supplements')
    .insert(supplementRows)
    .select('id, name')

  if (suppErr) {
    console.error('ERROR inserting supplements:', suppErr.message)
    process.exit(1)
  }
  console.log(`[ok] supplements created: ${suppData.length} items`)
  for (const s of suppData) {
    console.log(`     ${s.id}  ${s.name}`)
  }

  // 4. Upsert model config (safe to re-run; one row per user)
  const { data: configData, error: configErr } = await supabase
    .from('model_config')
    .upsert({ user_id: userId!, config: MODEL_CONFIG }, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (configErr) {
    console.error('ERROR upserting model config:', configErr.message)
    process.exit(1)
  }
  console.log(`[ok] model config upserted: ${configData.id}`)

  console.log('\n=== Done ===\n')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
