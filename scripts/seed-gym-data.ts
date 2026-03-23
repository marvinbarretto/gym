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
  name: 'My Gym',
  location: 'Watford',
  notes: 'Joined March 2026',
}

const EQUIPMENT_DATA: Array<{ name: string; type: 'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio' }> = [
  { name: 'Chest Press Machine',  type: 'machine'     },
  { name: 'Lat Pulldown',         type: 'cable'       },
  { name: 'Leg Press',            type: 'machine'     },
  { name: 'Cable Station',        type: 'cable'       },
  { name: 'Smith Machine',        type: 'machine'     },
  { name: 'Dumbbells',            type: 'free_weight' },
  { name: 'Treadmill',            type: 'cardio'      },
  { name: 'Stationary Bike',      type: 'cardio'      },
  { name: 'Rowing Machine',       type: 'cardio'      },
]

const SUPPLEMENTS_DATA: Array<{ name: string; type: 'protein' | 'creatine' | 'vitamin' | 'other'; dosage_unit: string }> = [
  { name: 'Whey Protein',          type: 'protein',   dosage_unit: 'scoop' },
  { name: 'Creatine Monohydrate',  type: 'creatine',  dosage_unit: 'g'     },
]

const MODEL_CONFIG = {
  in_session:    'claude-haiku-4-5',
  post_session:  'claude-sonnet-4-6',
  deep_analysis: 'claude-opus',
  fallback:      'gemini-2.5-flash',
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
  for (const [role, model] of Object.entries(MODEL_CONFIG)) {
    console.log(`  ${role.padEnd(16)} ${model}`)
  }

  if (!live) {
    console.log('\n[dry-run] No data written. Rerun with --live <user-id> to apply.\n')
    return
  }

  // -------------------------------------------------------------------------
  // Live writes
  // -------------------------------------------------------------------------

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
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
