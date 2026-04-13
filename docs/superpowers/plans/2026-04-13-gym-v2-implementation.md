# Gym V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the gym session logging flow at `/v2` with Zustand state, AI-as-parser (no tool calling), and server-side exercise resolution.

**Architecture:** Zustand store owns session + exercise state. AI returns structured JSON (exercise names, not UUIDs). Server resolves names → UUIDs and writes to DB. Tracker reads from store. Chat is a dumb input layer.

**Tech Stack:** Next.js 16, Zustand, AI SDK v6, Supabase (gym schema), Vitest, SCSS Modules.

**Spec:** `docs/superpowers/specs/2026-04-13-gym-v2-redesign.md`

---

### Task 1: Install Zustand

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zustand**

```bash
npm install zustand
```

- [ ] **Step 2: Verify it installed**

```bash
node -e "require('zustand')" && echo "ok"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zustand dependency"
```

---

### Task 2: Exercise Resolver

Server-side function that fuzzy-matches exercise names to UUIDs. No Supabase dependency in the function itself — it takes a list of exercises and a query string. Supabase is the caller's problem.

**Files:**
- Create: `src/lib/ai/exercise-resolver.ts`
- Create: `src/lib/ai/exercise-resolver.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/ai/exercise-resolver.test.ts
import { describe, it, expect } from 'vitest'
import { resolveExercise } from './exercise-resolver'

const EXERCISES = [
  { id: 'uuid-1', name: 'Chest Press Machine' },
  { id: 'uuid-2', name: 'Treadmill Run' },
  { id: 'uuid-3', name: 'Lat Pulldown' },
  { id: 'uuid-4', name: 'Seated Cable Row' },
  { id: 'uuid-5', name: 'Dumbbell Shoulder Press' },
  { id: 'uuid-6', name: 'Pec Deck' },
]

describe('resolveExercise', () => {
  it('exact match (case-insensitive)', () => {
    const result = resolveExercise('chest press machine', EXERCISES)
    expect(result).toEqual({ match: 'exact', exercise: EXERCISES[0] })
  })

  it('partial match — "chest press" matches "Chest Press Machine"', () => {
    const result = resolveExercise('chest press', EXERCISES)
    expect(result).toEqual({ match: 'fuzzy', exercise: EXERCISES[0] })
  })

  it('partial match — "treadmill" matches "Treadmill Run"', () => {
    const result = resolveExercise('treadmill', EXERCISES)
    expect(result).toEqual({ match: 'fuzzy', exercise: EXERCISES[1] })
  })

  it('ambiguous — "press" matches multiple exercises', () => {
    const result = resolveExercise('press', EXERCISES)
    expect(result.match).toBe('ambiguous')
    expect(result.candidates!.length).toBeGreaterThan(1)
  })

  it('no match', () => {
    const result = resolveExercise('swimming', EXERCISES)
    expect(result).toEqual({ match: 'none' })
  })

  it('handles canonical name from AI exactly', () => {
    const result = resolveExercise('Lat Pulldown', EXERCISES)
    expect(result).toEqual({ match: 'exact', exercise: EXERCISES[2] })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/ai/exercise-resolver.test.ts
```

Expected: FAIL — `resolveExercise` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/ai/exercise-resolver.ts

interface Exercise {
  id: string
  name: string
}

type ResolveResult =
  | { match: 'exact'; exercise: Exercise }
  | { match: 'fuzzy'; exercise: Exercise }
  | { match: 'ambiguous'; candidates: Exercise[] }
  | { match: 'none' }

export function resolveExercise(query: string, exercises: Exercise[]): ResolveResult {
  const q = query.toLowerCase().trim()

  // 1. Exact match (case-insensitive)
  const exact = exercises.find(e => e.name.toLowerCase() === q)
  if (exact) return { match: 'exact', exercise: exact }

  // 2. Fuzzy: exercise name contains all words from query
  const words = q.split(/\s+/)
  const fuzzy = exercises.filter(e => {
    const name = e.name.toLowerCase()
    return words.every(w => name.includes(w))
  })

  if (fuzzy.length === 1) return { match: 'fuzzy', exercise: fuzzy[0] }
  if (fuzzy.length > 1) return { match: 'ambiguous', candidates: fuzzy }

  // 3. Looser: any word from query appears in exercise name
  const loose = exercises.filter(e => {
    const name = e.name.toLowerCase()
    return words.some(w => name.includes(w))
  })

  if (loose.length === 1) return { match: 'fuzzy', exercise: loose[0] }
  if (loose.length > 1) return { match: 'ambiguous', candidates: loose }

  return { match: 'none' }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/ai/exercise-resolver.test.ts
```

Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/exercise-resolver.ts src/lib/ai/exercise-resolver.test.ts
git commit -m "feat: add exercise name resolver with fuzzy matching"
```

---

### Task 3: AI Response Parser

Extracts structured JSON from the AI's text response. The AI returns mixed text + JSON. This function pulls out the JSON blocks and validates their shape.

**Files:**
- Create: `src/lib/ai/response-parser.ts`
- Create: `src/lib/ai/response-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/ai/response-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseAiResponse, type ParsedEntry } from './response-parser'

describe('parseAiResponse', () => {
  it('extracts log_sets from JSON block', () => {
    const text = 'Logged your chest press.\n```json\n{"type":"log_sets","exercise":"Chest Press Machine","sets":[{"reps":10,"weight_kg":40},{"reps":10,"weight_kg":40},{"reps":10,"weight_kg":40}]}\n```'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toEqual({
      type: 'log_sets',
      exercise: 'Chest Press Machine',
      sets: [
        { reps: 10, weight_kg: 40 },
        { reps: 10, weight_kg: 40 },
        { reps: 10, weight_kg: 40 },
      ],
    })
    expect(result.message).toBe('Logged your chest press.')
  })

  it('extracts log_cardio', () => {
    const text = '```json\n{"type":"log_cardio","exercise":"Treadmill Run","duration_min":30,"distance_km":5}\n```'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toEqual({
      type: 'log_cardio',
      exercise: 'Treadmill Run',
      duration_min: 30,
      distance_km: 5,
    })
  })

  it('extracts chat-only response (no JSON)', () => {
    const text = 'How did that feel? Sounded heavy.'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(0)
    expect(result.message).toBe('How did that feel? Sounded heavy.')
  })

  it('extracts multiple entries from array', () => {
    const text = '```json\n[{"type":"log_sets","exercise":"Bench Press","sets":[{"reps":8,"weight_kg":60}]},{"type":"log_cardio","exercise":"Treadmill Run","duration_min":10}]\n```'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(2)
  })

  it('handles malformed JSON gracefully', () => {
    const text = '```json\n{broken json\n```\nHere is some text.'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(0)
    expect(result.message).toContain('Here is some text')
  })

  it('extracts JSON without code fence (bare JSON in response)', () => {
    const text = '{"type":"log_sets","exercise":"Lat Pulldown","sets":[{"reps":12,"weight_kg":30}]}'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].exercise).toBe('Lat Pulldown')
  })

  it('handles clarify type', () => {
    const text = '```json\n{"type":"clarify","message":"Which machine — chest press or pec deck?"}\n```'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(0)
    expect(result.message).toBe('Which machine — chest press or pec deck?')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/ai/response-parser.test.ts
```

Expected: FAIL — `parseAiResponse` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/ai/response-parser.ts

export interface SetData {
  reps?: number
  weight_kg?: number
  rpe?: number
  duration_s?: number
  notes?: string
}

export type ParsedEntry =
  | { type: 'log_sets'; exercise: string; sets: SetData[] }
  | { type: 'log_cardio'; exercise: string; duration_min: number; distance_km?: number; notes?: string }

interface ParseResult {
  entries: ParsedEntry[]
  message: string
}

export function parseAiResponse(text: string): ParseResult {
  const entries: ParsedEntry[] = []
  let message = text

  // Try to extract JSON from code fences first
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g
  let fenceMatch: RegExpExecArray | null
  const fenceMatches: string[] = []

  while ((fenceMatch = fenceRegex.exec(text)) !== null) {
    fenceMatches.push(fenceMatch[1].trim())
    // Remove the fenced block from the message text
    message = message.replace(fenceMatch[0], '').trim()
  }

  // If no fences found, try to parse the whole text as JSON
  if (fenceMatches.length === 0) {
    const trimmed = text.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      fenceMatches.push(trimmed)
      message = ''
    }
  }

  for (const raw of fenceMatches) {
    try {
      const parsed = JSON.parse(raw)
      const items = Array.isArray(parsed) ? parsed : [parsed]

      for (const item of items) {
        if (item.type === 'log_sets' && item.exercise && Array.isArray(item.sets)) {
          entries.push({
            type: 'log_sets',
            exercise: item.exercise,
            sets: item.sets,
          })
        } else if (item.type === 'log_cardio' && item.exercise && typeof item.duration_min === 'number') {
          entries.push({
            type: 'log_cardio',
            exercise: item.exercise,
            duration_min: item.duration_min,
            distance_km: item.distance_km,
            notes: item.notes,
          })
        } else if (item.type === 'clarify' && item.message) {
          // Clarification goes into the message, not entries
          message = item.message
        } else if (item.type === 'chat' && item.message) {
          message = item.message
        }
      }
    } catch {
      // Malformed JSON — ignore this block
    }
  }

  return { entries, message: message.trim() }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/ai/response-parser.test.ts
```

Expected: 7 passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/response-parser.ts src/lib/ai/response-parser.test.ts
git commit -m "feat: add AI response parser for structured workout data"
```

---

### Task 4: Zustand Store

Single store owning session state, exercise log, and UI state. No Supabase calls inside the store — callers do fetches and call store actions with results.

**Files:**
- Create: `src/lib/store/gym-store.ts`
- Create: `src/lib/store/gym-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/store/gym-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createGymStore, type GymState } from './gym-store'

// Create a fresh store for each test (not the global singleton)
let store: ReturnType<typeof createGymStore>

beforeEach(() => {
  store = createGymStore()
})

describe('session', () => {
  it('starts with no session', () => {
    expect(store.getState().session).toBeNull()
  })

  it('sets session', () => {
    store.getState().setSession({ id: 's1', started_at: '2026-04-13T10:00:00Z' })
    expect(store.getState().session).toEqual({ id: 's1', started_at: '2026-04-13T10:00:00Z' })
  })

  it('clears session and resets exercises', () => {
    store.getState().setSession({ id: 's1', started_at: '2026-04-13T10:00:00Z' })
    store.getState().addSets([{ id: 'set1', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 1, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null }])
    expect(store.getState().sets).toHaveLength(1)

    store.getState().clearSession()
    expect(store.getState().session).toBeNull()
    expect(store.getState().sets).toHaveLength(0)
    expect(store.getState().cardio).toHaveLength(0)
  })
})

describe('sets', () => {
  it('adds sets', () => {
    store.getState().addSets([
      { id: 'set1', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 1, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
      { id: 'set2', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 2, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
    ])
    expect(store.getState().sets).toHaveLength(2)
  })

  it('removes sets by IDs (undo)', () => {
    store.getState().addSets([
      { id: 'set1', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 1, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
      { id: 'set2', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 2, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
    ])
    store.getState().removeSets(['set1'])
    expect(store.getState().sets).toHaveLength(1)
    expect(store.getState().sets[0].id).toBe('set2')
  })
})

describe('cardio', () => {
  it('adds cardio entry', () => {
    store.getState().addCardio({ id: 'c1', session_id: 's1', exercise_id: 'e2', exercise_name: 'Treadmill', duration_s: 1800, distance_km: 5, avg_heart_rate: null, notes: null })
    expect(store.getState().cardio).toHaveLength(1)
  })

  it('removes cardio entry (undo)', () => {
    store.getState().addCardio({ id: 'c1', session_id: 's1', exercise_id: 'e2', exercise_name: 'Treadmill', duration_s: 1800, distance_km: 5, avg_heart_rate: null, notes: null })
    store.getState().removeCardio('c1')
    expect(store.getState().cardio).toHaveLength(0)
  })
})

describe('exercise groups', () => {
  it('groups sets by exercise', () => {
    store.getState().addSets([
      { id: 's1', session_id: 'x', exercise_id: 'e1', exercise_name: 'Bench', set_number: 1, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
      { id: 's2', session_id: 'x', exercise_id: 'e1', exercise_name: 'Bench', set_number: 2, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
      { id: 's3', session_id: 'x', exercise_id: 'e2', exercise_name: 'Squat', set_number: 1, reps: 8, weight_kg: 60, rpe: null, duration_s: null, notes: null },
    ])
    const groups = store.getState().exerciseGroups()
    expect(groups).toHaveLength(2)
    expect(groups[0].exerciseName).toBe('Bench')
    expect(groups[0].sets).toHaveLength(2)
    expect(groups[1].exerciseName).toBe('Squat')
    expect(groups[1].sets).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/store/gym-store.test.ts
```

Expected: FAIL — `createGymStore` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/store/gym-store.ts
import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

// Types that include the resolved exercise name (not in DB, added by our resolver)
export interface SessionSet {
  id: string
  session_id: string
  exercise_id: string
  exercise_name: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  duration_s: number | null
  notes: string | null
}

export interface SessionCardio {
  id: string
  session_id: string
  exercise_id: string
  exercise_name: string
  duration_s: number
  distance_km: number | null
  avg_heart_rate: number | null
  notes: string | null
}

export interface Session {
  id: string
  started_at: string
}

export interface ExerciseGroup {
  exerciseId: string
  exerciseName: string
  sets: SessionSet[]
}

export interface GymState {
  // Session
  session: Session | null
  setSession: (session: Session) => void
  clearSession: () => void

  // Exercise log
  sets: SessionSet[]
  cardio: SessionCardio[]
  addSets: (sets: SessionSet[]) => void
  removeSets: (ids: string[]) => void
  addCardio: (entry: SessionCardio) => void
  removeCardio: (id: string) => void
  loadSessionData: (sets: SessionSet[], cardio: SessionCardio[]) => void

  // Derived
  exerciseGroups: () => ExerciseGroup[]

  // UI
  activeModel: string | null
  setActiveModel: (model: string | null) => void
}

export function createGymStore() {
  return createStore<GymState>((set, get) => ({
    session: null,
    setSession: (session) => set({ session }),
    clearSession: () => set({ session: null, sets: [], cardio: [] }),

    sets: [],
    cardio: [],
    addSets: (newSets) => set((state) => ({ sets: [...state.sets, ...newSets] })),
    removeSets: (ids) => set((state) => ({ sets: state.sets.filter(s => !ids.includes(s.id)) })),
    addCardio: (entry) => set((state) => ({ cardio: [...state.cardio, entry] })),
    removeCardio: (id) => set((state) => ({ cardio: state.cardio.filter(c => c.id !== id) })),
    loadSessionData: (sets, cardio) => set({ sets, cardio }),

    exerciseGroups: () => {
      const { sets } = get()
      const groups: ExerciseGroup[] = []
      const seen = new Map<string, ExerciseGroup>()
      const order: string[] = []

      for (const s of sets) {
        if (!seen.has(s.exercise_id)) {
          const group: ExerciseGroup = {
            exerciseId: s.exercise_id,
            exerciseName: s.exercise_name,
            sets: [],
          }
          seen.set(s.exercise_id, group)
          order.push(s.exercise_id)
        }
        seen.get(s.exercise_id)!.sets.push(s)
      }

      for (const key of order) {
        groups.push(seen.get(key)!)
      }
      return groups
    },

    activeModel: null,
    setActiveModel: (model) => set({ activeModel: model }),
  }))
}

// Singleton store for the app
const store = createGymStore()

// React hook — use this in components
export function useGymStore<T>(selector: (state: GymState) => T): T {
  return useStore(store, selector)
}

// Direct access for non-React code (API responses, etc)
export const gymStore = store
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/store/gym-store.test.ts
```

Expected: 7 passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/gym-store.ts src/lib/store/gym-store.test.ts
git commit -m "feat: add Zustand gym store for session state management"
```

---

### Task 5: V2 System Prompt

Parser-focused system prompt. Loads exercise names from DB so the AI can match canonical names.

**Files:**
- Create: `src/lib/ai/system-prompt-v2.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/lib/ai/system-prompt-v2.ts
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

/**
 * Build the v2 system prompt with exercise vocabulary loaded from DB.
 */
export async function buildSystemPromptV2(supabase: Supabase): Promise<string> {
  const parts = [BASE_PROMPT]

  // Load all exercise names for vocabulary
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/system-prompt-v2.ts
git commit -m "feat: add v2 parser-focused system prompt"
```

---

### Task 6: Parse API Endpoint

Receives parsed workout data, resolves exercise names to UUIDs, saves to DB. Returns saved rows with IDs.

**Files:**
- Create: `src/app/api/v2/parse/route.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/app/api/v2/parse/route.ts
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
    // Resolve exercise name → UUID
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
      // Get current max set_number for this exercise in this session
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/v2/parse/route.ts
git commit -m "feat: add v2 parse endpoint — resolves names, saves to DB"
```

---

### Task 7: V2 Chat API

Thin streaming endpoint. No tools, no conversation persistence. Just AI + system prompt → streamed text.

**Files:**
- Create: `src/app/api/v2/chat/route.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/app/api/v2/chat/route.ts
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getModelId, resolveModel, DEFAULT_MODEL_CONFIG, FREE_FALLBACK_CHAIN, type ModelConfig } from '@/lib/ai/model-router'
import { buildSystemPromptV2 } from '@/lib/ai/system-prompt-v2'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401 })

    const { messages }: { messages: UIMessage[] } = await request.json()
    console.log('[v2/chat] user:', user.email, '| messages:', messages.length)

    // Load model config
    const { data: configRow } = await supabase
      .from('model_config')
      .select('config')
      .eq('user_id', user.id)
      .single()

    const modelConfig: ModelConfig = (configRow?.config as unknown as ModelConfig) ?? DEFAULT_MODEL_CONFIG
    const modelId = getModelId('in_session', modelConfig)
    console.log('[v2/chat] model:', modelId)

    const systemPrompt = await buildSystemPromptV2(supabase)

    const result = streamText({
      model: resolveModel(modelId),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      onFinish: ({ usage }) => {
        if (usage) {
          console.log(`[v2/chat] tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`)
        }
      },
      onError: ({ error }) => {
        console.error('[v2/chat] stream error:', error)
      },
    })

    const response = result.toUIMessageStreamResponse()
    response.headers.set('X-Model-Id', modelId)
    return response
  } catch (error) {
    console.error('[v2/chat] error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/v2/chat/route.ts
git commit -m "feat: add v2 chat endpoint — streaming AI, no tools"
```

---

### Task 8: V2 Chat Interface

The main UI component. Reads from Zustand store, sends messages via `useChat`, parses AI responses, calls parse endpoint, updates store.

**Files:**
- Create: `src/components/v2/chat-interface.tsx`
- Create: `src/components/v2/chat-interface.module.scss`

- [ ] **Step 1: Write the component**

```typescript
// src/components/v2/chat-interface.tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { MessageBubble } from '@/components/chat/message-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { useGymStore, type SessionSet, type SessionCardio } from '@/lib/store/gym-store'
import { parseAiResponse } from '@/lib/ai/response-parser'
import styles from './chat-interface.module.scss'

export function V2ChatInterface() {
  const session = useGymStore(s => s.session)
  const addSets = useGymStore(s => s.addSets)
  const addCardio = useGymStore(s => s.addCardio)
  const setActiveModel = useGymStore(s => s.setActiveModel)
  const scrollRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/v2/chat',
    fetch: async (input, init) => {
      const response = await fetch(input, init)
      const model = response.headers.get('X-Model-Id')
      if (model) setActiveModel(model)
      return response
    },
  }), [setActiveModel])

  // Chat key resets when session changes — clears message history
  const chatKey = session?.id ?? 'no-session'
  const { messages, status, sendMessage } = useChat({ transport, id: chatKey })

  const isLoading = status === 'streaming' || status === 'submitted'

  // When AI finishes a response, parse it and save workout data
  const prevStatus = useRef(status)
  const processedMessages = useRef(new Set<string>())

  const handleAiResponse = useCallback(async (text: string, msgId: string) => {
    if (processedMessages.current.has(msgId)) return
    processedMessages.current.add(msgId)

    if (!session) return

    const { entries, message } = parseAiResponse(text)
    if (entries.length === 0) return

    console.log('[v2] parsed entries:', entries.length, 'from message:', msgId)

    // Send to parse endpoint
    try {
      const res = await fetch('/api/v2/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, entries }),
      })
      const { saved, errors } = await res.json()

      // Update store with saved data
      const newSets: SessionSet[] = []
      const newCardio: SessionCardio[] = []

      for (const item of saved) {
        if (item.type === 'set') {
          newSets.push({
            id: item.id,
            session_id: session.id,
            exercise_id: item.data.exercise_id,
            exercise_name: item.exercise_name,
            set_number: item.data.set_number,
            reps: item.data.reps,
            weight_kg: item.data.weight_kg,
            rpe: item.data.rpe,
            duration_s: item.data.duration_s,
            notes: item.data.notes,
          })
        } else if (item.type === 'cardio') {
          newCardio.push({
            id: item.id,
            session_id: session.id,
            exercise_id: item.data.exercise_id,
            exercise_name: item.exercise_name,
            duration_s: item.data.duration_s,
            distance_km: item.data.distance_km,
            avg_heart_rate: item.data.avg_heart_rate,
            notes: item.data.notes,
          })
        }
      }

      if (newSets.length) addSets(newSets)
      for (const c of newCardio) addCardio(c)

      if (errors.length) {
        console.warn('[v2] parse errors:', errors)
      }

      console.log('[v2] saved:', newSets.length, 'sets,', newCardio.length, 'cardio')
    } catch (err) {
      console.error('[v2] parse request failed:', err)
    }
  }, [session, addSets, addCardio])

  // Watch for AI responses finishing
  useEffect(() => {
    if (prevStatus.current === 'streaming' && status === 'ready') {
      // Find the last assistant message
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
      if (lastAssistant) {
        const text = lastAssistant.parts
          ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map(p => p.text)
          .join('') ?? ''
        if (text) handleAiResponse(text, lastAssistant.id)
      }
    }
    prevStatus.current = status
  }, [status, messages, handleAiResponse])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.container}>
      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <p>{session ? 'Session started. What did you do?' : 'Start a session to begin logging.'}</p>
          </div>
        )}
        {messages.map((msg) => {
          const textContent = msg.parts
            ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('') ?? ''

          if (!textContent) return null

          // For assistant messages, strip JSON blocks from display
          let displayText = textContent
          if (msg.role === 'assistant') {
            displayText = textContent
              .replace(/```(?:json)?\s*\n?[\s\S]*?\n?```/g, '')
              .trim()
            // If the whole message was JSON, try to extract the message field
            if (!displayText && textContent.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(textContent.trim())
                displayText = parsed.message ?? ''
              } catch { /* show nothing */ }
            }
          }

          if (!displayText) return null

          return (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              content={displayText}
            />
          )
        })}
        {isLoading && (
          <div className={styles.typing}>Thinking...</div>
        )}
      </div>
      <ChatInput onSend={(text) => sendMessage({ text })} isLoading={isLoading} />
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

```scss
// src/components/v2/chat-interface.module.scss
.container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  padding-bottom: 4rem;
  gap: 0;

  scrollbar-width: thin;
  scrollbar-color: var(--color-border, #333) transparent;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted, #999);
  font-size: 0.9375rem;
  text-align: center;
  padding: 2rem;

  p { margin: 0; }
}

.typing {
  align-self: flex-start;
  color: var(--color-muted, #999);
  font-size: 0.875rem;
  padding: 0.5rem 0;
  font-style: italic;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/v2/chat-interface.tsx src/components/v2/chat-interface.module.scss
git commit -m "feat: add v2 chat interface — parses AI responses, saves via store"
```

---

### Task 9: V2 Tracker

Reads sets and cardio from Zustand store. Shows both. No API fetching — just store state.

**Files:**
- Create: `src/components/v2/tracker.tsx`
- Create: `src/components/v2/tracker.module.scss`

- [ ] **Step 1: Write the component**

```typescript
// src/components/v2/tracker.tsx
'use client'

import { useState } from 'react'
import { useGymStore } from '@/lib/store/gym-store'
import styles from './tracker.module.scss'

export function V2Tracker() {
  const session = useGymStore(s => s.session)
  const groups = useGymStore(s => s.exerciseGroups())
  const cardio = useGymStore(s => s.cardio)
  const sets = useGymStore(s => s.sets)
  const [expanded, setExpanded] = useState(true)

  if (!session) return null

  const elapsed = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)
  const totalItems = sets.length + cardio.length

  if (!expanded) {
    return (
      <div className={styles.collapsed} onClick={() => setExpanded(true)}>
        <span>{groups.length + cardio.length} exercises · {totalItems} entries · {elapsed}min</span>
        <span className={styles.expand}>expand</span>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.date}>
            {new Date(session.started_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <span className={styles.elapsed}>{elapsed}min</span>
          <span className={styles.sessionId}>{session.id.slice(0, 8)}</span>
        </div>
        <button className={styles.collapse} onClick={() => setExpanded(false)}>collapse</button>
      </div>
      <div className={styles.body}>
        {totalItems === 0 && (
          <div className={styles.empty}>No exercises logged yet</div>
        )}
        {groups.map(g => (
          <div key={g.exerciseId} className={styles.exerciseGroup}>
            <div className={styles.exerciseName}>{g.exerciseName}</div>
            {g.sets.map(s => (
              <div key={s.id} className={styles.setRow}>
                Set {s.set_number}: {s.reps ?? '—'} reps{s.weight_kg ? ` @ ${s.weight_kg}kg` : ''}{s.rpe ? ` RPE ${s.rpe}` : ''}
              </div>
            ))}
          </div>
        ))}
        {cardio.map(c => (
          <div key={c.id} className={styles.exerciseGroup}>
            <div className={styles.exerciseName}>{c.exercise_name}</div>
            <div className={styles.setRow}>
              {Math.round(c.duration_s / 60)}min{c.distance_km ? ` · ${c.distance_km}km` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

```scss
// src/components/v2/tracker.module.scss
.panel {
  background: var(--color-surface, #1a1a1a);
  border-bottom: 1px solid var(--color-border, #333);
  max-height: 40vh;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  position: sticky;
  top: 0;
  background: var(--color-surface, #1a1a1a);
  z-index: 1;
}

.headerLeft {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.date {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #e0e0e0);
}

.elapsed {
  font-size: 0.75rem;
  color: var(--color-muted, #999);
}

.sessionId {
  font-size: 0.65rem;
  color: var(--color-muted, #666);
  font-family: var(--font-geist-mono, monospace);
}

.collapse {
  background: none;
  border: none;
  color: var(--color-muted, #666);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.75rem;
}

.body {
  padding: 0 1rem 0.75rem;
}

.empty {
  font-size: 0.8125rem;
  color: var(--color-muted, #666);
  padding: 0.5rem 0;
}

.exerciseGroup {
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--color-border, #222);

  &:last-child { border-bottom: none; }
}

.exerciseName {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #e0e0e0);
  margin-bottom: 0.25rem;
}

.setRow {
  font-size: 0.75rem;
  color: var(--color-muted, #999);
  padding-left: 0.5rem;
}

.collapsed {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 1rem;
  background: var(--color-surface, #1a1a1a);
  border-bottom: 1px solid var(--color-border, #333);
  font-size: 0.8125rem;
  color: var(--color-muted, #999);
  cursor: pointer;

  &:hover { background: var(--color-border, #222); }
}

.expand {
  color: #e8c547;
  font-size: 0.75rem;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/v2/tracker.tsx src/components/v2/tracker.module.scss
git commit -m "feat: add v2 tracker — reads sets and cardio from Zustand store"
```

---

### Task 10: V2 Page

The `/v2` route. Manages session lifecycle (start/end/resume) via Zustand store. Renders tracker + chat.

**Files:**
- Create: `src/app/v2/page.tsx`
- Create: `src/app/v2/page.module.scss`

- [ ] **Step 1: Write the page**

```typescript
// src/app/v2/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { V2ChatInterface } from '@/components/v2/chat-interface'
import { V2Tracker } from '@/components/v2/tracker'
import { useGymStore, type SessionSet, type SessionCardio } from '@/lib/store/gym-store'
import styles from './page.module.scss'

export default function V2Page() {
  const session = useGymStore(s => s.session)
  const setSession = useGymStore(s => s.setSession)
  const clearSession = useGymStore(s => s.clearSession)
  const loadSessionData = useGymStore(s => s.loadSessionData)
  const activeModel = useGymStore(s => s.activeModel)
  const [loading, setLoading] = useState(true)
  const [showResume, setShowResume] = useState(false)
  const [pendingSession, setPendingSession] = useState<{ id: string; started_at: string } | null>(null)

  // Check for open session on mount
  useEffect(() => {
    fetch('/api/sessions/active')
      .then(r => r.ok ? r.json() : { session: null })
      .then(({ session: s }) => {
        if (s) {
          setPendingSession(s)
          setShowResume(true)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Load existing sets/cardio when session is set
  useEffect(() => {
    if (!session) return
    fetch(`/api/sessions/${session.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const detail = data?.session ?? data
        if (!detail) return
        const sets: SessionSet[] = (detail.session_sets ?? []).map((s: Record<string, unknown>) => ({
          ...s,
          exercise_name: (s.exercises as Record<string, string> | null)?.name ?? 'Unknown',
        }))
        const cardio: SessionCardio[] = (detail.session_cardio ?? []).map((c: Record<string, unknown>) => ({
          ...c,
          exercise_name: (c.exercises as Record<string, string> | null)?.name ?? 'Unknown',
        }))
        loadSessionData(sets, cardio)
        console.log('[v2] loaded session data:', sets.length, 'sets,', cardio.length, 'cardio')
      })
  }, [session, loadSessionData])

  const handleStart = useCallback(async () => {
    const res = await fetch('/api/sessions/active', { method: 'POST' })
    if (!res.ok) return
    const { session: s } = await res.json()
    setSession(s)
    console.log('[v2] session started:', s.id)
  }, [setSession])

  const handleEnd = useCallback(async () => {
    if (!session) return
    await fetch('/api/sessions/active', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end', sessionId: session.id }),
    })
    clearSession()
    console.log('[v2] session ended')
  }, [session, clearSession])

  const handleResume = useCallback(() => {
    if (pendingSession) {
      setSession(pendingSession)
      setShowResume(false)
    }
  }, [pendingSession, setSession])

  const handleDismiss = useCallback(async () => {
    if (pendingSession) {
      await fetch('/api/sessions/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', sessionId: pendingSession.id }),
      })
    }
    setShowResume(false)
    setPendingSession(null)
  }, [pendingSession])

  if (loading) return null

  return (
    <div className={styles.container}>
      {activeModel && <div className={styles.modelTag}>{activeModel.split('/').pop()}</div>}

      {showResume && pendingSession && (
        <div className={styles.resumePrompt}>
          <p>Open session from {new Date(pendingSession.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          <div className={styles.resumeActions}>
            <button onClick={handleResume}>Resume</button>
            <button onClick={handleDismiss} className={styles.secondary}>Close it</button>
          </div>
        </div>
      )}

      <V2Tracker />

      {session && (
        <div className={styles.sessionActions}>
          <button className={styles.endBtn} onClick={handleEnd}>End Session</button>
        </div>
      )}

      {!session && !showResume && (
        <div className={styles.startContainer}>
          <button className={styles.startBtn} onClick={handleStart}>Start Session</button>
        </div>
      )}

      {session && <V2ChatInterface />}
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

```scss
// src/app/v2/page.module.scss
.container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.modelTag {
  align-self: center;
  font-size: 0.7rem;
  color: var(--color-muted, #999);
  background: var(--color-surface, #1a1a1a);
  border: 1px solid var(--color-border, #333);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  margin-top: 0.5rem;
}

.resumePrompt {
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
  text-align: center;

  p {
    color: var(--color-muted, #999);
    margin-bottom: 0.75rem;
  }
}

.resumeActions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;

  button {
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, #333);
    background: var(--color-surface, #1a1a1a);
    color: var(--color-text, #e0e0e0);
    cursor: pointer;
    font-size: 0.875rem;

    &:hover { background: var(--color-border, #333); }
  }

  .secondary { color: var(--color-muted, #999); }
}

.sessionActions {
  display: flex;
  justify-content: center;
  padding: 0.5rem;
}

.endBtn {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  border: 1px solid #5a2d2d;
  background: #3a1a1a;
  color: #e0a0a0;
  cursor: pointer;

  &:hover { background: #4a2a2a; }
}

.startContainer {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.startBtn {
  padding: 0.75rem 2rem;
  border-radius: 8px;
  border: 1px solid var(--color-border, #333);
  background: var(--color-surface, #1a1a1a);
  color: var(--color-text, #e0e0e0);
  cursor: pointer;
  font-size: 1rem;

  &:hover { background: var(--color-border, #333); }
}
```

- [ ] **Step 3: Build and test locally**

```bash
npm run build
```

Expected: builds without errors, `/v2` route listed.

- [ ] **Step 4: Commit**

```bash
git add src/app/v2/page.tsx src/app/v2/page.module.scss
git commit -m "feat: add v2 page — session lifecycle via Zustand, tracker + chat"
```

---

### Task 11: Smoke Test and Deploy

Manual end-to-end test on localhost, then deploy.

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (exercise-resolver, response-parser, gym-store)

- [ ] **Step 2: Start dev server and test manually**

```bash
npm run dev
```

Open `http://localhost:3000/v2`:
1. Click "Start Session" — tracker appears with date and session ID
2. Type "3 sets of 10 on chest press at 40kg" — AI responds, tracker updates with 3 sets
3. Type "treadmill 5km 30 mins" — AI responds, tracker shows cardio entry
4. Type "how was that?" — AI responds with chat, no data saved
5. Click "End Session" — session closes

- [ ] **Step 3: Deploy**

```bash
npx vercel --prod
```

- [ ] **Step 4: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: smoke test fixes for v2"
```

---

## Self-Review

**Spec coverage:**
- ✅ AI as parser (no tools) — Task 5, 7
- ✅ Server-side exercise resolution — Task 2, 6
- ✅ Zustand store — Task 4
- ✅ Response parser — Task 3
- ✅ V2 chat interface — Task 8
- ✅ Tracker shows sets AND cardio — Task 9
- ✅ V2 page with session lifecycle — Task 10
- ✅ Save immediately — Task 8 (handleAiResponse)
- ✅ No conversation persistence — Task 7 (no addMessage calls)
- ✅ Tests for core loop — Tasks 2, 3, 4
- ⚠️ Undo/edit after save — NOT implemented (deferred to follow-up, needs UI design)
- ⚠️ Fallback model on error — NOT implemented in v2 chat route (kept simple, can add later)

**Placeholder scan:** None found.

**Type consistency:** `SessionSet`, `SessionCardio`, `ParsedEntry`, `ExerciseGroup` — used consistently across store, parser, components, and API.
