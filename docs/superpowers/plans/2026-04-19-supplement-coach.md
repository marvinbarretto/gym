# Supplement Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a supplement coach that teaches, nudges, and logs — with protocol and scheduling in **jimbo-api** (reusing its Telegram sender, cron pattern, and vault), a thin gym PWA client for teaching UI and session-end signal, and a Hermes cron trigger. Drops the unused `gym.supplements*` schema as dead code.

**Architecture:** Three repos touched. **jimbo-api** (Node/Hono/SQLite) owns rule evaluation, nudge state, supplement catalog, logs. **gym** PWA (Next.js) is a thin client — server-side proxy + two pages. **hermes** (agent platform) ticks jimbo every 30 min. Gym PWA POSTs to jimbo on session end so the coach can push post-workout nudges immediately.

**Tech Stack:** Node 22, Hono + @hono/zod-openapi, better-sqlite3, Vitest; Next.js 16 App Router, SCSS modules, Zustand; Hermes cron + skill SOP.

**Spec:** `docs/superpowers/specs/2026-04-18-supplement-coach-design.md`

**Repo paths:**
- Jimbo: `/Users/marvinbarretto/development/jimbo/jimbo-api`
- Gym: `/Users/marvinbarretto/development/gym` (this repo)
- Hermes: `/Users/marvinbarretto/development/hub/hermes`

**Cross-repo note:** Each task's `git` commands run in the repo that owns the changed files. Tasks say "commit in jimbo-api", "commit in gym", etc. — check your pwd before committing.

---

## Phase 1 — Jimbo Coach Backend

### Task 1: Append coach tables to Jimbo schema

**Files:**
- Modify: `/Users/marvinbarretto/development/jimbo/jimbo-api/src/db/index.ts` (append inside the `SCHEMA` const)

- [ ] **Step 1: Read the existing schema block.** Open `src/db/index.ts`. The `SCHEMA` const is a single template literal with `CREATE TABLE IF NOT EXISTS ...` statements. Coach tables get appended before the closing backtick.

- [ ] **Step 2: Append the coach block**

Insert the following block near the end of the `SCHEMA` template literal (before the final backtick; after the last existing `CREATE TABLE`). Keep existing whitespace style.

```sql
-- ──────────────────────────────────────────────────────────────────
-- Supplement Coach
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coach_supplements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('protein','creatine','vitamin','other')),
  dose_amount REAL NOT NULL,
  dose_unit TEXT NOT NULL,
  conditions TEXT NOT NULL DEFAULT '{}',
  timing_tags TEXT NOT NULL DEFAULT '[]',
  rationale_short TEXT NOT NULL,
  rationale_long TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  remaining_amount REAL,
  loading_started_at TEXT,
  loading_daily_dose REAL,
  loading_duration_days INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coach_nudges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nudge_key TEXT NOT NULL UNIQUE,
  anchor TEXT NOT NULL,
  supplements TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  pushed_at TEXT,
  delivered_via TEXT,
  state TEXT CHECK (state IN ('pending','logged','skipped','expired')) NOT NULL DEFAULT 'pending',
  action_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coach_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplement_id TEXT NOT NULL REFERENCES coach_supplements(id) ON DELETE CASCADE,
  taken_at TEXT NOT NULL DEFAULT (datetime('now')),
  dosage REAL NOT NULL,
  source TEXT CHECK (source IN ('in_app','telegram_deeplink','manual')) NOT NULL,
  nudge_id INTEGER REFERENCES coach_nudges(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_coach_nudges_state_scheduled ON coach_nudges(state, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_coach_logs_supplement_time ON coach_logs(supplement_id, taken_at DESC);
```

- [ ] **Step 3: Verify schema loads without error**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && rm -f /tmp/coach-schema-check.db && CONTEXT_DB_PATH=/tmp/coach-schema-check.db npx tsx -e "import('./src/db/index.js').then(m => { m.getDb(); console.log('ok'); })"`
Expected: prints `ok` with no SQLite errors.

- [ ] **Step 4: Commit in jimbo-api**

```bash
cd /Users/marvinbarretto/development/jimbo/jimbo-api
git add src/db/index.ts
git commit -m "feat: add coach_* schema tables for supplement coach"
```

---

### Task 2: Coach TypeScript types

**Files:**
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/src/types/coach.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/types/coach.ts
// Types mirror the coach_* SQLite schema. JSON columns are parsed/serialized at
// the service boundary — these types carry the parsed shape.

export type SupplementType = 'protein' | 'creatine' | 'vitamin' | 'other';

export type TimingTag = 'morning' | 'post_workout' | 'rest_day_fallback' | 'bedtime' | 'loading';

export type NudgeAnchor = TimingTag;

export type NudgeState = 'pending' | 'logged' | 'skipped' | 'expired';

export type LogSource = 'in_app' | 'telegram_deeplink' | 'manual';

export interface SupplementConditions {
  needs_food?: boolean;
  avoid_food?: boolean;
  min_gap_from_food_min?: number;
}

export interface CoachSupplement {
  id: string;
  name: string;
  type: SupplementType;
  dose_amount: number;
  dose_unit: string;
  conditions: SupplementConditions;
  timing_tags: TimingTag[];
  rationale_short: string;
  rationale_long: string;
  active: boolean;
  remaining_amount: number | null;
  loading_started_at: string | null;      // ISO date YYYY-MM-DD
  loading_daily_dose: number | null;
  loading_duration_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface NudgeSupplementSnap {
  supplement_id: string;
  name: string;
  dose_amount: number;
  dose_unit: string;
  conditions: SupplementConditions;
  rationale_short: string;
}

export interface CoachNudge {
  id: number;
  nudge_key: string;                      // e.g. '2026-04-19:morning'
  anchor: NudgeAnchor;
  supplements: NudgeSupplementSnap[];
  scheduled_for: string;                   // ISO timestamp
  pushed_at: string | null;
  delivered_via: 'telegram' | 'in_app_only' | null;
  state: NudgeState;
  action_at: string | null;
  created_at: string;
}

export interface CoachLog {
  id: number;
  supplement_id: string;
  taken_at: string;
  dosage: number;
  source: LogSource;
  nudge_id: number | null;
  notes: string | null;
}

export interface NudgeDraft {
  nudge_key: string;
  anchor: NudgeAnchor;
  supplements: NudgeSupplementSnap[];
  scheduled_for: string;                   // ISO timestamp
}
```

- [ ] **Step 2: Commit in jimbo-api**

```bash
cd /Users/marvinbarretto/development/jimbo/jimbo-api
git add src/types/coach.ts
git commit -m "feat: add coach TypeScript types"
```

---

### Task 3: Coach Zod schemas (OpenAPI)

**Files:**
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/src/schemas/coach.ts`

- [ ] **Step 1: Create the Zod schemas**

```typescript
// src/schemas/coach.ts
import { z } from '@hono/zod-openapi';

const SupplementTypeSchema = z.enum(['protein', 'creatine', 'vitamin', 'other']);
const TimingTagSchema = z.enum(['morning', 'post_workout', 'rest_day_fallback', 'bedtime', 'loading']);
const NudgeStateSchema = z.enum(['pending', 'logged', 'skipped', 'expired']);
const LogSourceSchema = z.enum(['in_app', 'telegram_deeplink', 'manual']);

export const ConditionsSchema = z.object({
  needs_food: z.boolean().optional(),
  avoid_food: z.boolean().optional(),
  min_gap_from_food_min: z.number().int().nonnegative().optional(),
}).openapi('CoachConditions');

export const SupplementSnapSchema = z.object({
  supplement_id: z.string(),
  name: z.string(),
  dose_amount: z.number(),
  dose_unit: z.string(),
  conditions: ConditionsSchema,
  rationale_short: z.string(),
}).openapi('CoachSupplementSnap');

export const SupplementSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: SupplementTypeSchema,
  dose_amount: z.number(),
  dose_unit: z.string(),
  conditions: ConditionsSchema,
  timing_tags: z.array(TimingTagSchema),
  rationale_short: z.string(),
  rationale_long: z.string(),
  active: z.boolean(),
  remaining_amount: z.number().nullable(),
  loading_started_at: z.string().nullable(),
  loading_daily_dose: z.number().nullable(),
  loading_duration_days: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi('CoachSupplement');

export const NudgeSchema = z.object({
  id: z.number(),
  nudge_key: z.string(),
  anchor: TimingTagSchema,
  supplements: z.array(SupplementSnapSchema),
  scheduled_for: z.string(),
  pushed_at: z.string().nullable(),
  delivered_via: z.enum(['telegram', 'in_app_only']).nullable(),
  state: NudgeStateSchema,
  action_at: z.string().nullable(),
  created_at: z.string(),
}).openapi('CoachNudge');

export const TodayResponseSchema = z.object({
  date: z.string(),
  pending: z.array(NudgeSchema),
  logged: z.array(NudgeSchema),
  skipped: z.array(NudgeSchema),
}).openapi('CoachToday');

export const LogRequestSchema = z.object({
  supplement_id: z.string(),
  dosage: z.number().positive(),
  source: LogSourceSchema,
  nudge_key: z.string().optional(),
}).openapi('CoachLogRequest');

export const LogResponseSchema = z.object({
  log_id: z.number(),
  remaining_amount: z.number().nullable(),
}).openapi('CoachLogResponse');

export const NudgeKeyBody = z.object({
  nudge_key: z.string(),
}).openapi('CoachNudgeKeyBody');

export const SessionEndRequestSchema = z.object({
  session_id: z.string(),
  ended_at: z.string(),
}).openapi('CoachSessionEndRequest');

export const InventoryItemSchema = z.object({
  supplement_id: z.string(),
  name: z.string(),
  remaining_amount: z.number().nullable(),
  dose_unit: z.string(),
  projected_days_left: z.number().nullable(),
  reorder_soon: z.boolean(),
}).openapi('CoachInventoryItem');

export const InventoryResponseSchema = z.object({
  items: z.array(InventoryItemSchema),
}).openapi('CoachInventoryResponse');

export const TickResponseSchema = z.object({
  generated: z.number(),
  pushed: z.number(),
  expired: z.number(),
}).openapi('CoachTickResponse');

export const OkResponseSchema = z.object({ ok: z.literal(true) }).openapi('CoachOk');

export const SupplementIdParam = z.object({
  id: z.string().openapi({ description: 'Supplement ID', example: 'supp_creatine' }),
});
```

- [ ] **Step 2: Commit in jimbo-api**

```bash
cd /Users/marvinbarretto/development/jimbo/jimbo-api
git add src/schemas/coach.ts
git commit -m "feat: add coach Zod/OpenAPI schemas"
```

---

### Task 4: Pure rule evaluation function — TDD

**Files:**
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/src/services/coach-rules.ts`
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/test/coach-rules.test.ts`

This task implements `generateDailyNudges`, a pure function that takes (clock, supplements, today's existing nudges) and returns the set of nudge drafts that *should* exist for today. Pure — no DB, no time source other than the injected `now`.

- [ ] **Step 1: Write the failing tests**

Create `test/coach-rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateDailyNudges } from '../src/services/coach-rules.js';
import type { CoachSupplement, CoachNudge } from '../src/types/coach.js';

function s(overrides: Partial<CoachSupplement> = {}): CoachSupplement {
  return {
    id: overrides.id ?? 'supp_x',
    name: overrides.name ?? 'Thing',
    type: overrides.type ?? 'vitamin',
    dose_amount: overrides.dose_amount ?? 1,
    dose_unit: overrides.dose_unit ?? 'tablet',
    conditions: overrides.conditions ?? {},
    timing_tags: overrides.timing_tags ?? [],
    rationale_short: overrides.rationale_short ?? 'why',
    rationale_long: overrides.rationale_long ?? 'why in detail',
    active: overrides.active ?? true,
    remaining_amount: overrides.remaining_amount ?? null,
    loading_started_at: overrides.loading_started_at ?? null,
    loading_daily_dose: overrides.loading_daily_dose ?? null,
    loading_duration_days: overrides.loading_duration_days ?? null,
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
  };
}

const NOW = new Date('2026-04-19T10:00:00Z');

describe('generateDailyNudges', () => {
  it('produces a morning nudge for supplements with the morning tag', () => {
    const drafts = generateDailyNudges({
      now: NOW,
      supplements: [s({ id: 'supp_d3', timing_tags: ['morning'] })],
      existingNudgesToday: [],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      nudge_key: '2026-04-19:morning',
      anchor: 'morning',
      scheduled_for: '2026-04-19T09:00:00.000Z',
    });
    expect(drafts[0].supplements.map(x => x.supplement_id)).toEqual(['supp_d3']);
  });

  it('groups multiple supplements under one anchor nudge', () => {
    const drafts = generateDailyNudges({
      now: NOW,
      supplements: [
        s({ id: 'supp_d3', timing_tags: ['morning'] }),
        s({ id: 'supp_mv', timing_tags: ['morning'] }),
      ],
      existingNudgesToday: [],
    });
    const morning = drafts.find(d => d.anchor === 'morning')!;
    expect(morning.supplements).toHaveLength(2);
  });

  it('omits inactive supplements', () => {
    const drafts = generateDailyNudges({
      now: NOW,
      supplements: [s({ timing_tags: ['morning'], active: false })],
      existingNudgesToday: [],
    });
    expect(drafts).toHaveLength(0);
  });

  it('produces a bedtime nudge at 22:00', () => {
    const drafts = generateDailyNudges({
      now: NOW,
      supplements: [s({ id: 'supp_zma', timing_tags: ['bedtime'] })],
      existingNudgesToday: [],
    });
    expect(drafts[0]).toMatchObject({
      anchor: 'bedtime',
      scheduled_for: '2026-04-19T22:00:00.000Z',
    });
  });

  it('produces rest_day_fallback only when no post_workout nudge exists today', () => {
    const drafts = generateDailyNudges({
      now: NOW,
      supplements: [s({ id: 'supp_whey', timing_tags: ['rest_day_fallback'] })],
      existingNudgesToday: [],
    });
    expect(drafts.some(d => d.anchor === 'rest_day_fallback')).toBe(true);
  });

  it('suppresses rest_day_fallback when a post_workout nudge already exists today', () => {
    const existing: CoachNudge = {
      id: 1,
      nudge_key: '2026-04-19:post_workout:sess-abc',
      anchor: 'post_workout',
      supplements: [],
      scheduled_for: '2026-04-19T10:15:00.000Z',
      pushed_at: '2026-04-19T10:16:00.000Z',
      delivered_via: 'telegram',
      state: 'pending',
      action_at: null,
      created_at: '2026-04-19T10:16:00.000Z',
    };
    const drafts = generateDailyNudges({
      now: NOW,
      supplements: [s({ id: 'supp_whey', timing_tags: ['rest_day_fallback'] })],
      existingNudgesToday: [existing],
    });
    expect(drafts.some(d => d.anchor === 'rest_day_fallback')).toBe(false);
  });

  it('emits four loading pushes for a supplement whose loading window is active', () => {
    const drafts = generateDailyNudges({
      now: NOW,
      supplements: [s({
        id: 'supp_creatine',
        timing_tags: ['loading'],
        loading_started_at: '2026-04-18',
        loading_daily_dose: 20,
        loading_duration_days: 5,
      })],
      existingNudgesToday: [],
    });
    const loadingDrafts = drafts.filter(d => d.anchor === 'loading');
    expect(loadingDrafts).toHaveLength(4);
    const times = loadingDrafts.map(d => d.scheduled_for);
    expect(times).toEqual([
      '2026-04-19T11:00:00.000Z',
      '2026-04-19T14:00:00.000Z',
      '2026-04-19T17:00:00.000Z',
      '2026-04-19T20:00:00.000Z',
    ]);
    for (const d of loadingDrafts) {
      expect(d.supplements[0].dose_amount).toBe(5); // 20 / 4
    }
  });

  it('does not emit loading pushes after the loading window ends', () => {
    const drafts = generateDailyNudges({
      now: new Date('2026-04-30T10:00:00Z'),
      supplements: [s({
        id: 'supp_creatine',
        timing_tags: ['loading'],
        loading_started_at: '2026-04-18',
        loading_duration_days: 5, // ends 2026-04-23
      })],
      existingNudgesToday: [],
    });
    expect(drafts.filter(d => d.anchor === 'loading')).toHaveLength(0);
  });

  it('uses stable nudge_keys so re-generation is idempotent', () => {
    const first = generateDailyNudges({
      now: NOW,
      supplements: [s({ id: 'supp_d3', timing_tags: ['morning'] })],
      existingNudgesToday: [],
    });
    const second = generateDailyNudges({
      now: NOW,
      supplements: [s({ id: 'supp_d3', timing_tags: ['morning'] })],
      existingNudgesToday: [],
    });
    expect(first.map(d => d.nudge_key)).toEqual(second.map(d => d.nudge_key));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npx vitest run test/coach-rules.test.ts`
Expected: FAIL with "Cannot find module '../src/services/coach-rules.js'".

- [ ] **Step 3: Write the implementation**

Create `src/services/coach-rules.ts`:

```typescript
// src/services/coach-rules.ts
// Pure rule evaluation — no DB, no clock beyond the injected `now`.
import type {
  CoachSupplement,
  CoachNudge,
  NudgeDraft,
  NudgeSupplementSnap,
} from '../types/coach.js';

interface Input {
  now: Date;
  supplements: CoachSupplement[];
  existingNudgesToday: CoachNudge[];
}

const ANCHOR_HOURS: Record<'morning' | 'rest_day_fallback' | 'bedtime', number> = {
  morning: 9,
  rest_day_fallback: 14,
  bedtime: 22,
};

const LOADING_HOURS = [11, 14, 17, 20];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function atHour(dateYmd: string, hour: number): string {
  return new Date(`${dateYmd}T${String(hour).padStart(2, '0')}:00:00Z`).toISOString();
}

function snap(s: CoachSupplement, doseOverride?: number): NudgeSupplementSnap {
  return {
    supplement_id: s.id,
    name: s.name,
    dose_amount: doseOverride ?? s.dose_amount,
    dose_unit: s.dose_unit,
    conditions: s.conditions,
    rationale_short: s.rationale_short,
  };
}

function loadingActive(s: CoachSupplement, now: Date): boolean {
  if (!s.loading_started_at || !s.loading_duration_days) return false;
  const start = new Date(`${s.loading_started_at}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + s.loading_duration_days);
  return now < end;
}

export function generateDailyNudges(input: Input): NudgeDraft[] {
  const today = isoDate(input.now);
  const active = input.supplements.filter(s => s.active);
  const drafts: NudgeDraft[] = [];

  for (const anchor of ['morning', 'bedtime'] as const) {
    const items = active.filter(s => s.timing_tags.includes(anchor));
    if (items.length === 0) continue;
    drafts.push({
      nudge_key: `${today}:${anchor}`,
      anchor,
      supplements: items.map(s => snap(s)),
      scheduled_for: atHour(today, ANCHOR_HOURS[anchor]),
    });
  }

  const hasPostWorkout = input.existingNudgesToday.some(n => n.anchor === 'post_workout');
  if (!hasPostWorkout) {
    const fallback = active.filter(s => s.timing_tags.includes('rest_day_fallback'));
    if (fallback.length > 0) {
      drafts.push({
        nudge_key: `${today}:rest_day_fallback`,
        anchor: 'rest_day_fallback',
        supplements: fallback.map(s => snap(s)),
        scheduled_for: atHour(today, ANCHOR_HOURS.rest_day_fallback),
      });
    }
  }

  for (const supp of active) {
    if (!supp.timing_tags.includes('loading')) continue;
    if (!loadingActive(supp, input.now)) continue;
    if (!supp.loading_daily_dose) continue;
    const perDose = supp.loading_daily_dose / LOADING_HOURS.length;
    for (const h of LOADING_HOURS) {
      drafts.push({
        nudge_key: `${today}:loading:${supp.id}:${h}`,
        anchor: 'loading',
        supplements: [snap(supp, perDose)],
        scheduled_for: atHour(today, h),
      });
    }
  }

  return drafts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npx vitest run test/coach-rules.test.ts`
Expected: all 9 tests PASS.

- [ ] **Step 5: Commit in jimbo-api**

```bash
cd /Users/marvinbarretto/development/jimbo/jimbo-api
git add src/services/coach-rules.ts test/coach-rules.test.ts
git commit -m "feat: add coach rule evaluation (pure function)"
```

---

### Task 5: Coach DB helpers

**Files:**
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/src/services/coach-db.ts`
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/test/coach-db.test.ts`

Thin DB helper module. Each function is a single SQL op wrapped for type safety. Parsing/serialization of JSON columns happens here.

- [ ] **Step 1: Write the failing tests**

Create `test/coach-db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const TEST_DB_DIR = './test/tmp-coach-db';
mkdirSync(TEST_DB_DIR, { recursive: true });
process.env.CONTEXT_DB_PATH = path.join(TEST_DB_DIR, 'test.db');

const {
  listActiveSupplements,
  insertSupplement,
  upsertNudge,
  getNudgesForDate,
  getPendingReadyNudges,
  markNudgePushed,
  markNudgeState,
  insertLog,
  decrementInventory,
  expirePendingBefore,
  getInventory,
  getSupplement,
} = await import('../src/services/coach-db.js');

import { getDb } from '../src/db/index.js';

function seedSupplement(id = 'supp_test') {
  insertSupplement({
    id,
    name: 'Test Supp',
    type: 'vitamin',
    dose_amount: 1,
    dose_unit: 'tablet',
    conditions: { needs_food: true },
    timing_tags: ['morning'],
    rationale_short: 'why',
    rationale_long: 'long why',
    active: true,
    remaining_amount: 30,
    loading_started_at: null,
    loading_daily_dose: null,
    loading_duration_days: null,
  });
}

describe('coach-db', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM coach_logs; DELETE FROM coach_nudges; DELETE FROM coach_supplements;');
  });

  afterAll(() => {
    rmSync(TEST_DB_DIR, { recursive: true, force: true });
  });

  it('inserts and lists active supplements, parsing JSON columns', () => {
    seedSupplement();
    const list = listActiveSupplements();
    expect(list).toHaveLength(1);
    expect(list[0].conditions).toEqual({ needs_food: true });
    expect(list[0].timing_tags).toEqual(['morning']);
    expect(list[0].active).toBe(true);
  });

  it('excludes inactive supplements from listActiveSupplements', () => {
    seedSupplement('supp_a');
    insertSupplement({
      id: 'supp_b', name: 'B', type: 'other',
      dose_amount: 1, dose_unit: 'g',
      conditions: {}, timing_tags: [],
      rationale_short: 's', rationale_long: 'l',
      active: false,
      remaining_amount: null,
      loading_started_at: null, loading_daily_dose: null, loading_duration_days: null,
    });
    const list = listActiveSupplements();
    expect(list.map(s => s.id)).toEqual(['supp_a']);
  });

  it('upsertNudge is idempotent on nudge_key', () => {
    const draft = {
      nudge_key: '2026-04-19:morning',
      anchor: 'morning' as const,
      supplements: [],
      scheduled_for: '2026-04-19T09:00:00.000Z',
    };
    const first = upsertNudge(draft);
    const second = upsertNudge(draft);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    const rows = getNudgesForDate('2026-04-19');
    expect(rows).toHaveLength(1);
  });

  it('getPendingReadyNudges returns only pending nudges whose scheduled_for <= now and pushed_at is null', () => {
    upsertNudge({ nudge_key: 'a', anchor: 'morning', supplements: [], scheduled_for: '2026-04-19T08:00:00.000Z' });
    upsertNudge({ nudge_key: 'b', anchor: 'bedtime', supplements: [], scheduled_for: '2026-04-19T22:00:00.000Z' });
    const ready = getPendingReadyNudges(new Date('2026-04-19T09:00:00Z'));
    expect(ready.map(r => r.nudge_key)).toEqual(['a']);
  });

  it('markNudgePushed sets pushed_at and delivered_via without changing state', () => {
    const { id } = upsertNudge({ nudge_key: 'k', anchor: 'morning', supplements: [], scheduled_for: '2026-04-19T09:00:00.000Z' });
    markNudgePushed(id, 'telegram', new Date('2026-04-19T09:01:00Z'));
    const row = getNudgesForDate('2026-04-19')[0];
    expect(row.pushed_at).toBe('2026-04-19T09:01:00.000Z');
    expect(row.delivered_via).toBe('telegram');
    expect(row.state).toBe('pending');
  });

  it('markNudgeState updates state and action_at', () => {
    const { id } = upsertNudge({ nudge_key: 'k', anchor: 'morning', supplements: [], scheduled_for: '2026-04-19T09:00:00.000Z' });
    markNudgeState(id, 'logged', new Date('2026-04-19T09:30:00Z'));
    const row = getNudgesForDate('2026-04-19')[0];
    expect(row.state).toBe('logged');
    expect(row.action_at).toBe('2026-04-19T09:30:00.000Z');
  });

  it('insertLog and decrementInventory work together', () => {
    seedSupplement();
    const log = insertLog({ supplement_id: 'supp_test', dosage: 1, source: 'in_app', nudge_id: null });
    expect(log.id).toBeGreaterThan(0);
    const remaining = decrementInventory('supp_test', 1);
    expect(remaining).toBe(29);
  });

  it('decrementInventory floors at zero if remaining is set', () => {
    insertSupplement({
      id: 'supp_low', name: 'Low', type: 'other',
      dose_amount: 1, dose_unit: 'g',
      conditions: {}, timing_tags: [],
      rationale_short: 's', rationale_long: 'l',
      active: true,
      remaining_amount: 2,
      loading_started_at: null, loading_daily_dose: null, loading_duration_days: null,
    });
    const r1 = decrementInventory('supp_low', 5);
    expect(r1).toBe(0);
  });

  it('expirePendingBefore moves stale pending nudges to expired', () => {
    upsertNudge({ nudge_key: 'old', anchor: 'morning', supplements: [], scheduled_for: '2026-04-18T09:00:00.000Z' });
    upsertNudge({ nudge_key: 'new', anchor: 'bedtime', supplements: [], scheduled_for: '2026-04-19T22:00:00.000Z' });
    const count = expirePendingBefore(new Date('2026-04-19T21:00:00Z'));
    expect(count).toBe(1);
    const rows = getNudgesForDate('2026-04-18').concat(getNudgesForDate('2026-04-19'));
    expect(rows.find(r => r.nudge_key === 'old')!.state).toBe('expired');
    expect(rows.find(r => r.nudge_key === 'new')!.state).toBe('pending');
  });

  it('getInventory computes projected_days_left based on daily dose and sets reorder_soon', () => {
    seedSupplement();                              // remaining 30, dose 1/day → 30 days
    const inv = getInventory();
    const item = inv.find(i => i.supplement_id === 'supp_test')!;
    expect(item.projected_days_left).toBe(30);
    expect(item.reorder_soon).toBe(false);
  });

  it('getSupplement returns a single parsed row or null', () => {
    seedSupplement();
    expect(getSupplement('supp_test')?.name).toBe('Test Supp');
    expect(getSupplement('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npx vitest run test/coach-db.test.ts`
Expected: FAIL with "Cannot find module '../src/services/coach-db.js'".

- [ ] **Step 3: Write the implementation**

Create `src/services/coach-db.ts`:

```typescript
// src/services/coach-db.ts
import { getDb } from '../db/index.js';
import type {
  CoachSupplement,
  CoachNudge,
  CoachLog,
  NudgeDraft,
  NudgeSupplementSnap,
  NudgeState,
} from '../types/coach.js';

interface SupplementRow {
  id: string;
  name: string;
  type: CoachSupplement['type'];
  dose_amount: number;
  dose_unit: string;
  conditions: string;
  timing_tags: string;
  rationale_short: string;
  rationale_long: string;
  active: number;
  remaining_amount: number | null;
  loading_started_at: string | null;
  loading_daily_dose: number | null;
  loading_duration_days: number | null;
  created_at: string;
  updated_at: string;
}

function parseSupplement(row: SupplementRow): CoachSupplement {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    dose_amount: row.dose_amount,
    dose_unit: row.dose_unit,
    conditions: JSON.parse(row.conditions),
    timing_tags: JSON.parse(row.timing_tags),
    rationale_short: row.rationale_short,
    rationale_long: row.rationale_long,
    active: row.active === 1,
    remaining_amount: row.remaining_amount,
    loading_started_at: row.loading_started_at,
    loading_daily_dose: row.loading_daily_dose,
    loading_duration_days: row.loading_duration_days,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface NudgeRow {
  id: number;
  nudge_key: string;
  anchor: CoachNudge['anchor'];
  supplements: string;
  scheduled_for: string;
  pushed_at: string | null;
  delivered_via: CoachNudge['delivered_via'];
  state: NudgeState;
  action_at: string | null;
  created_at: string;
}

function parseNudge(row: NudgeRow): CoachNudge {
  return {
    id: row.id,
    nudge_key: row.nudge_key,
    anchor: row.anchor,
    supplements: JSON.parse(row.supplements),
    scheduled_for: row.scheduled_for,
    pushed_at: row.pushed_at,
    delivered_via: row.delivered_via,
    state: row.state,
    action_at: row.action_at,
    created_at: row.created_at,
  };
}

export interface SupplementInsert {
  id: string;
  name: string;
  type: CoachSupplement['type'];
  dose_amount: number;
  dose_unit: string;
  conditions: CoachSupplement['conditions'];
  timing_tags: CoachSupplement['timing_tags'];
  rationale_short: string;
  rationale_long: string;
  active: boolean;
  remaining_amount: number | null;
  loading_started_at: string | null;
  loading_daily_dose: number | null;
  loading_duration_days: number | null;
}

export function insertSupplement(s: SupplementInsert): void {
  getDb().prepare(`
    INSERT INTO coach_supplements (
      id, name, type, dose_amount, dose_unit, conditions, timing_tags,
      rationale_short, rationale_long, active, remaining_amount,
      loading_started_at, loading_daily_dose, loading_duration_days
    ) VALUES (
      @id, @name, @type, @dose_amount, @dose_unit, @conditions, @timing_tags,
      @rationale_short, @rationale_long, @active, @remaining_amount,
      @loading_started_at, @loading_daily_dose, @loading_duration_days
    )
  `).run({
    ...s,
    conditions: JSON.stringify(s.conditions),
    timing_tags: JSON.stringify(s.timing_tags),
    active: s.active ? 1 : 0,
  });
}

export function listActiveSupplements(): CoachSupplement[] {
  const rows = getDb().prepare('SELECT * FROM coach_supplements WHERE active = 1 ORDER BY name').all() as SupplementRow[];
  return rows.map(parseSupplement);
}

export function getSupplement(id: string): CoachSupplement | null {
  const row = getDb().prepare('SELECT * FROM coach_supplements WHERE id = ?').get(id) as SupplementRow | undefined;
  return row ? parseSupplement(row) : null;
}

export function upsertNudge(draft: NudgeDraft): { id: number; inserted: boolean } {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM coach_nudges WHERE nudge_key = ?').get(draft.nudge_key) as { id: number } | undefined;
  if (existing) return { id: existing.id, inserted: false };
  const result = db.prepare(`
    INSERT INTO coach_nudges (nudge_key, anchor, supplements, scheduled_for, state)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(draft.nudge_key, draft.anchor, JSON.stringify(draft.supplements), draft.scheduled_for);
  return { id: Number(result.lastInsertRowid), inserted: true };
}

export function insertPushedNudge(args: {
  nudge_key: string;
  anchor: CoachNudge['anchor'];
  supplements: NudgeSupplementSnap[];
  scheduled_for: string;
  pushed_at: string;
  delivered_via: 'telegram' | 'in_app_only';
}): number {
  const result = getDb().prepare(`
    INSERT INTO coach_nudges (nudge_key, anchor, supplements, scheduled_for, state, pushed_at, delivered_via)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    args.nudge_key, args.anchor, JSON.stringify(args.supplements),
    args.scheduled_for, args.pushed_at, args.delivered_via,
  );
  return Number(result.lastInsertRowid);
}

export function getNudgesForDate(ymd: string): CoachNudge[] {
  const rows = getDb().prepare(`
    SELECT * FROM coach_nudges WHERE nudge_key LIKE ? ORDER BY scheduled_for ASC
  `).all(`${ymd}:%`) as NudgeRow[];
  return rows.map(parseNudge);
}

export function getNudgeByKey(nudge_key: string): CoachNudge | null {
  const row = getDb().prepare('SELECT * FROM coach_nudges WHERE nudge_key = ?').get(nudge_key) as NudgeRow | undefined;
  return row ? parseNudge(row) : null;
}

export function getPendingReadyNudges(now: Date): CoachNudge[] {
  const nowIso = now.toISOString();
  const rows = getDb().prepare(`
    SELECT * FROM coach_nudges
    WHERE state = 'pending' AND pushed_at IS NULL AND scheduled_for <= ?
    ORDER BY scheduled_for ASC
  `).all(nowIso) as NudgeRow[];
  return rows.map(parseNudge);
}

export function markNudgePushed(id: number, via: 'telegram' | 'in_app_only', at: Date): void {
  getDb().prepare(`
    UPDATE coach_nudges SET pushed_at = ?, delivered_via = ? WHERE id = ?
  `).run(at.toISOString(), via, id);
}

export function markNudgeState(id: number, state: NudgeState, at: Date): void {
  getDb().prepare(`
    UPDATE coach_nudges SET state = ?, action_at = ? WHERE id = ?
  `).run(state, at.toISOString(), id);
}

export function expirePendingBefore(cutoff: Date): number {
  const result = getDb().prepare(`
    UPDATE coach_nudges SET state = 'expired'
    WHERE state = 'pending' AND scheduled_for < ?
  `).run(cutoff.toISOString());
  return result.changes;
}

export interface LogInsert {
  supplement_id: string;
  dosage: number;
  source: CoachLog['source'];
  nudge_id: number | null;
  notes?: string | null;
}

export function insertLog(input: LogInsert): { id: number } {
  const result = getDb().prepare(`
    INSERT INTO coach_logs (supplement_id, dosage, source, nudge_id, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(input.supplement_id, input.dosage, input.source, input.nudge_id, input.notes ?? null);
  return { id: Number(result.lastInsertRowid) };
}

export function decrementInventory(supplement_id: string, amount: number): number | null {
  const db = getDb();
  const row = db.prepare('SELECT remaining_amount FROM coach_supplements WHERE id = ?').get(supplement_id) as { remaining_amount: number | null } | undefined;
  if (!row || row.remaining_amount === null) return null;
  const next = Math.max(0, row.remaining_amount - amount);
  db.prepare('UPDATE coach_supplements SET remaining_amount = ?, updated_at = datetime("now") WHERE id = ?').run(next, supplement_id);
  return next;
}

export interface InventoryItem {
  supplement_id: string;
  name: string;
  remaining_amount: number | null;
  dose_unit: string;
  projected_days_left: number | null;
  reorder_soon: boolean;
}

export function getInventory(): InventoryItem[] {
  return listActiveSupplements().map(s => {
    const days = s.remaining_amount !== null && s.dose_amount > 0
      ? Math.floor(s.remaining_amount / s.dose_amount)
      : null;
    return {
      supplement_id: s.id,
      name: s.name,
      remaining_amount: s.remaining_amount,
      dose_unit: s.dose_unit,
      projected_days_left: days,
      reorder_soon: days !== null && days <= 5,
    };
  });
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npx vitest run test/coach-db.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit in jimbo-api**

```bash
cd /Users/marvinbarretto/development/jimbo/jimbo-api
git add src/services/coach-db.ts test/coach-db.test.ts
git commit -m "feat: add coach db helpers"
```

---

### Task 6: Coach orchestration service (tick + session-end + log + message formatting)

**Files:**
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/src/services/coach.ts`
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/test/coach.test.ts`

Glue service. Formats messages for Telegram, orchestrates `generateDailyNudges` with DB helpers, triggers `sendTelegram`, handles the `log`/`skip`/`later` actions.

Telegram sending is injected via a `{ sendTelegram }` dependency so tests can assert without a real bot.

- [ ] **Step 1: Write the failing tests**

Create `test/coach.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const TEST_DB_DIR = './test/tmp-coach';
mkdirSync(TEST_DB_DIR, { recursive: true });
process.env.CONTEXT_DB_PATH = path.join(TEST_DB_DIR, 'test.db');
process.env.GYM_PWA_URL = 'https://gym.test';

const {
  tick,
  recordSessionEnd,
  logIntake,
  skipNudge,
  laterNudge,
  formatNudgeMessage,
  getToday,
} = await import('../src/services/coach.js');

import { getDb } from '../src/db/index.js';
import { insertSupplement } from '../src/services/coach-db.js';

function seedCreatine() {
  insertSupplement({
    id: 'supp_creatine',
    name: 'Creatine Monohydrate',
    type: 'creatine',
    dose_amount: 5,
    dose_unit: 'g',
    conditions: {},
    timing_tags: ['post_workout', 'rest_day_fallback'],
    rationale_short: 'Saturates muscle creatine stores. Daily 5g.',
    rationale_long: '## Creatine\n\nCreatine monohydrate at 5g/day...',
    active: true,
    remaining_amount: 100,
    loading_started_at: null,
    loading_daily_dose: null,
    loading_duration_days: null,
  });
}

function seedWhey() {
  insertSupplement({
    id: 'supp_whey',
    name: 'Whey Protein',
    type: 'protein',
    dose_amount: 30,
    dose_unit: 'g',
    conditions: {},
    timing_tags: ['post_workout', 'rest_day_fallback'],
    rationale_short: 'Fast-absorbed protein for muscle repair.',
    rationale_long: '## Whey\n\n...',
    active: true,
    remaining_amount: 600,
    loading_started_at: null,
    loading_daily_dose: null,
    loading_duration_days: null,
  });
}

describe('coach service', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM coach_logs; DELETE FROM coach_nudges; DELETE FROM coach_supplements;');
  });

  afterAll(() => rmSync(TEST_DB_DIR, { recursive: true, force: true }));

  describe('formatNudgeMessage', () => {
    it('renders teaching-heavy text with items and a deep-link', () => {
      const text = formatNudgeMessage({
        id: 1,
        nudge_key: '2026-04-19:morning',
        anchor: 'morning',
        supplements: [
          { supplement_id: 'supp_d3', name: 'Vitamin D3', dose_amount: 1, dose_unit: 'tablet', conditions: { needs_food: true }, rationale_short: 'Fat-soluble.' },
        ],
        scheduled_for: '2026-04-19T09:00:00Z',
        pushed_at: null, delivered_via: null, state: 'pending', action_at: null, created_at: '',
      });
      expect(text).toContain('Vitamin D3');
      expect(text).toContain('with first meal');            // morning-specific copy
      expect(text).toContain('Fat-soluble.');
      expect(text).toContain('https://gym.test/coach/today#nudge=2026-04-19:morning');
    });
  });

  describe('tick', () => {
    it('generates nudges, pushes ready ones, updates state', () => {
      seedCreatine();                                       // only rest_day_fallback timing_tag in this seed
      const sendTelegram = vi.fn().mockResolvedValue(undefined);
      const now = new Date('2026-04-19T14:05:00Z');         // past 14:00 fallback anchor
      return tick({ now, sendTelegram }).then(result => {
        expect(result.generated).toBeGreaterThan(0);
        expect(result.pushed).toBeGreaterThanOrEqual(1);
        expect(sendTelegram).toHaveBeenCalled();
      });
    });

    it('is idempotent — second tick in the same minute does not re-push', async () => {
      seedCreatine();
      const sendTelegram = vi.fn().mockResolvedValue(undefined);
      const now = new Date('2026-04-19T14:05:00Z');
      await tick({ now, sendTelegram });
      sendTelegram.mockClear();
      await tick({ now, sendTelegram });
      expect(sendTelegram).not.toHaveBeenCalled();
    });

    it('expires stale pending nudges', async () => {
      seedCreatine();
      const sendTelegram = vi.fn().mockResolvedValue(undefined);
      await tick({ now: new Date('2026-04-18T14:05:00Z'), sendTelegram }); // yesterday
      sendTelegram.mockClear();
      const result = await tick({ now: new Date('2026-04-20T09:00:00Z'), sendTelegram }); // 2 days later
      expect(result.expired).toBeGreaterThanOrEqual(1);
    });
  });

  describe('recordSessionEnd', () => {
    it('creates a post-workout nudge and pushes immediately', async () => {
      seedCreatine();
      seedWhey();
      const sendTelegram = vi.fn().mockResolvedValue(undefined);
      const result = await recordSessionEnd({
        session_id: 'sess-abc',
        ended_at: '2026-04-19T13:00:00Z',
        sendTelegram,
      });
      expect(result.pushed).toBe(true);
      expect(sendTelegram).toHaveBeenCalledOnce();
      const msg = sendTelegram.mock.calls[0][0] as string;
      expect(msg).toContain('Whey');
      expect(msg).toContain('Creatine');
    });

    it('returns pushed=false and no-ops when no supplements have post_workout tag', async () => {
      const sendTelegram = vi.fn();
      const result = await recordSessionEnd({
        session_id: 'sess-xyz',
        ended_at: '2026-04-19T13:00:00Z',
        sendTelegram,
      });
      expect(result.pushed).toBe(false);
      expect(sendTelegram).not.toHaveBeenCalled();
    });
  });

  describe('logIntake', () => {
    it('writes log, decrements inventory, marks nudge logged', async () => {
      seedWhey();
      const sendTelegram = vi.fn().mockResolvedValue(undefined);
      await recordSessionEnd({ session_id: 'sess-1', ended_at: '2026-04-19T13:00:00Z', sendTelegram });
      const today = await getToday(new Date('2026-04-19T13:30:00Z'));
      const nudge = today.pending.find(n => n.anchor === 'post_workout')!;
      const result = await logIntake({ supplement_id: 'supp_whey', dosage: 30, source: 'telegram_deeplink', nudge_key: nudge.nudge_key, now: new Date('2026-04-19T13:45:00Z') });
      expect(result.log_id).toBeGreaterThan(0);
      expect(result.remaining_amount).toBe(570);
      const after = await getToday(new Date('2026-04-19T14:00:00Z'));
      expect(after.logged.some(n => n.nudge_key === nudge.nudge_key)).toBe(true);
    });
  });

  describe('skipNudge', () => {
    it('marks the nudge as skipped', async () => {
      seedCreatine();
      const sendTelegram = vi.fn().mockResolvedValue(undefined);
      await tick({ now: new Date('2026-04-19T14:05:00Z'), sendTelegram });
      const today = await getToday(new Date('2026-04-19T14:10:00Z'));
      const key = today.pending[0].nudge_key;
      await skipNudge({ nudge_key: key, now: new Date('2026-04-19T14:11:00Z') });
      const after = await getToday(new Date('2026-04-19T14:12:00Z'));
      expect(after.skipped.some(n => n.nudge_key === key)).toBe(true);
    });
  });

  describe('laterNudge', () => {
    it('moves scheduled_for forward by 2 hours, stays pending', async () => {
      seedCreatine();
      const sendTelegram = vi.fn().mockResolvedValue(undefined);
      await tick({ now: new Date('2026-04-19T14:05:00Z'), sendTelegram });
      const today = await getToday(new Date('2026-04-19T14:10:00Z'));
      const original = today.pending[0];
      await laterNudge({ nudge_key: original.nudge_key, now: new Date('2026-04-19T14:11:00Z') });
      const after = await getToday(new Date('2026-04-19T14:12:00Z'));
      const updated = after.pending.find(n => n.nudge_key === original.nudge_key)!;
      const deltaMs = new Date(updated.scheduled_for).getTime() - new Date(original.scheduled_for).getTime();
      expect(deltaMs).toBe(2 * 60 * 60 * 1000);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npx vitest run test/coach.test.ts`
Expected: FAIL with "Cannot find module '../src/services/coach.js'".

- [ ] **Step 3: Write the implementation**

Create `src/services/coach.ts`:

```typescript
// src/services/coach.ts
// Orchestration: generate → push → state. Telegram sender is injected.
import { generateDailyNudges } from './coach-rules.js';
import {
  listActiveSupplements,
  upsertNudge,
  getNudgesForDate,
  getNudgeByKey,
  getPendingReadyNudges,
  markNudgePushed,
  markNudgeState,
  expirePendingBefore,
  insertLog,
  decrementInventory,
  insertPushedNudge,
} from './coach-db.js';
import { sendTelegram as realSendTelegram } from './telegram.js';
import { getDb } from '../db/index.js';
import type { CoachNudge, NudgeSupplementSnap, LogSource } from '../types/coach.js';

type SendTelegramFn = (message: string, parseMode?: 'HTML' | 'Markdown') => Promise<void>;

function gymUrl(): string {
  return process.env.GYM_PWA_URL ?? 'https://gym.marvinbarretto.dev';
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ANCHOR_HEADERS: Record<CoachNudge['anchor'], string> = {
  morning: 'Morning stack — take with first meal',
  post_workout: 'Post-workout window — within 30 minutes',
  rest_day_fallback: 'Daily stack — no session today',
  bedtime: 'Bedtime — wind-down stack',
  loading: 'Creatine loading dose',
};

const ANCHOR_CONDITION_HINTS: Record<CoachNudge['anchor'], string> = {
  morning: 'Take with your first meal today. Fat-soluble vitamins absorb ~50% better with dietary fat. No breakfast? Save them for lunch. Skip the day if you don\'t eat — one miss doesn\'t matter, consistency over weeks does.',
  post_workout: 'Muscle-protein-synthesis is elevated for ~30 min after training.',
  rest_day_fallback: 'Protein and creatine are daily — training-day or not.',
  bedtime: 'Avoid food within 30 min — calcium and iron block zinc absorption.',
  loading: 'Part of the 5-day loading phase to saturate stores quickly (20g/day split into four). After day 5, drops to 5g/day maintenance.',
};

export function formatNudgeMessage(n: CoachNudge): string {
  const header = ANCHOR_HEADERS[n.anchor];
  const hint = ANCHOR_CONDITION_HINTS[n.anchor];
  const lines = n.supplements.map(s => `• ${s.name} — ${s.dose_amount}${s.dose_unit}\n  ${s.rationale_short}`);
  const link = `${gymUrl()}/coach/today#nudge=${n.nudge_key}`;
  return [
    header,
    '',
    ...lines,
    '',
    hint,
    '',
    `Open: ${link}`,
  ].join('\n');
}

interface TickOpts {
  now: Date;
  sendTelegram?: SendTelegramFn;
}

interface TickResult {
  generated: number;
  pushed: number;
  expired: number;
}

export async function tick(opts: TickOpts): Promise<TickResult> {
  const now = opts.now;
  const send = opts.sendTelegram ?? realSendTelegram;

  const today = isoDate(now);
  const drafts = generateDailyNudges({
    now,
    supplements: listActiveSupplements(),
    existingNudgesToday: getNudgesForDate(today),
  });
  let generated = 0;
  for (const d of drafts) {
    const { inserted } = upsertNudge(d);
    if (inserted) generated += 1;
  }

  const ready = getPendingReadyNudges(now);
  let pushed = 0;
  for (const n of ready) {
    await send(formatNudgeMessage(n));
    markNudgePushed(n.id, 'telegram', now);
    pushed += 1;
  }

  const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const expired = expirePendingBefore(cutoff);

  return { generated, pushed, expired };
}

interface SessionEndOpts {
  session_id: string;
  ended_at: string;
  sendTelegram?: SendTelegramFn;
  now?: Date;
}

export async function recordSessionEnd(opts: SessionEndOpts): Promise<{ pushed: boolean; nudge_key?: string }> {
  const send = opts.sendTelegram ?? realSendTelegram;
  const pushedAt = opts.now ?? new Date();
  const ended = new Date(opts.ended_at);
  const scheduledFor = new Date(ended.getTime() + 15 * 60 * 1000).toISOString();

  const supplements = listActiveSupplements().filter(s => s.timing_tags.includes('post_workout'));
  if (supplements.length === 0) return { pushed: false };

  const snap: NudgeSupplementSnap[] = supplements.map(s => ({
    supplement_id: s.id,
    name: s.name,
    dose_amount: s.dose_amount,
    dose_unit: s.dose_unit,
    conditions: s.conditions,
    rationale_short: s.rationale_short,
  }));

  const nudge_key = `${isoDate(ended)}:post_workout:${opts.session_id}`;
  const existing = getNudgeByKey(nudge_key);
  if (existing) return { pushed: false, nudge_key };

  const id = insertPushedNudge({
    nudge_key,
    anchor: 'post_workout',
    supplements: snap,
    scheduled_for: scheduledFor,
    pushed_at: pushedAt.toISOString(),
    delivered_via: 'telegram',
  });

  await send(formatNudgeMessage({
    id,
    nudge_key,
    anchor: 'post_workout',
    supplements: snap,
    scheduled_for: scheduledFor,
    pushed_at: pushedAt.toISOString(),
    delivered_via: 'telegram',
    state: 'pending',
    action_at: null,
    created_at: pushedAt.toISOString(),
  }));

  return { pushed: true, nudge_key };
}

interface LogOpts {
  supplement_id: string;
  dosage: number;
  source: LogSource;
  nudge_key?: string;
  now?: Date;
}

export async function logIntake(opts: LogOpts): Promise<{ log_id: number; remaining_amount: number | null }> {
  const now = opts.now ?? new Date();
  let nudge_id: number | null = null;
  if (opts.nudge_key) {
    const n = getNudgeByKey(opts.nudge_key);
    if (n) {
      nudge_id = n.id;
      markNudgeState(n.id, 'logged', now);
    }
  }
  const { id } = insertLog({
    supplement_id: opts.supplement_id,
    dosage: opts.dosage,
    source: opts.source,
    nudge_id,
  });
  const remaining_amount = decrementInventory(opts.supplement_id, opts.dosage);
  return { log_id: id, remaining_amount };
}

export async function skipNudge(opts: { nudge_key: string; now?: Date }): Promise<{ ok: true }> {
  const now = opts.now ?? new Date();
  const n = getNudgeByKey(opts.nudge_key);
  if (n) markNudgeState(n.id, 'skipped', now);
  return { ok: true };
}

export async function laterNudge(opts: { nudge_key: string; now?: Date }): Promise<{ ok: true }> {
  const n = getNudgeByKey(opts.nudge_key);
  if (!n) return { ok: true };
  const next = new Date(new Date(n.scheduled_for).getTime() + 2 * 60 * 60 * 1000).toISOString();
  getDb().prepare('UPDATE coach_nudges SET scheduled_for = ?, pushed_at = NULL WHERE id = ?').run(next, n.id);
  return { ok: true };
}

export async function getToday(now: Date): Promise<{
  date: string;
  pending: CoachNudge[];
  logged: CoachNudge[];
  skipped: CoachNudge[];
}> {
  const ymd = isoDate(now);
  const all = getNudgesForDate(ymd);
  return {
    date: ymd,
    pending: all.filter(n => n.state === 'pending'),
    logged: all.filter(n => n.state === 'logged'),
    skipped: all.filter(n => n.state === 'skipped'),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npx vitest run test/coach.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit in jimbo-api**

```bash
cd /Users/marvinbarretto/development/jimbo/jimbo-api
git add src/services/coach.ts test/coach.test.ts
git commit -m "feat: add coach orchestration service"
```

---

### Task 7: Coach routes + mount

**Files:**
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/src/routes/coach.ts`
- Modify: `/Users/marvinbarretto/development/jimbo/jimbo-api/src/route-publication.ts`
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/test/coach-routes.test.ts`

- [ ] **Step 1: Write the failing route tests**

Create `test/coach-routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const TEST_DB_DIR = './test/tmp-coach-routes';
mkdirSync(TEST_DB_DIR, { recursive: true });
process.env.CONTEXT_DB_PATH = path.join(TEST_DB_DIR, 'test.db');
process.env.API_KEY = 'test-key';
process.env.GYM_PWA_URL = 'https://gym.test';

const coach = (await import('../src/routes/coach.js')).default;
import { OpenAPIHono } from '@hono/zod-openapi';
import { apiKeyAuth } from '../src/middleware/auth.js';
import { getDb } from '../src/db/index.js';
import { insertSupplement } from '../src/services/coach-db.js';

function buildApp() {
  const app = new OpenAPIHono();
  app.use('/api/*', apiKeyAuth);
  app.route('/api/coach', coach);
  return app;
}

async function req(app: ReturnType<typeof buildApp>, method: string, path: string, body?: unknown) {
  return app.request(`http://test${path}`, {
    method,
    headers: {
      'X-API-Key': 'test-key',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('coach routes', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM coach_logs; DELETE FROM coach_nudges; DELETE FROM coach_supplements;');
  });

  afterAll(() => rmSync(TEST_DB_DIR, { recursive: true, force: true }));

  it('GET /api/coach/today returns pending/logged/skipped shape', async () => {
    const app = buildApp();
    const res = await req(app, 'GET', '/api/coach/today');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ pending: [], logged: [], skipped: [] });
  });

  it('POST /api/coach/log writes a log and returns remaining_amount', async () => {
    insertSupplement({
      id: 'supp_whey', name: 'Whey', type: 'protein',
      dose_amount: 30, dose_unit: 'g',
      conditions: {}, timing_tags: [],
      rationale_short: 's', rationale_long: 'l',
      active: true,
      remaining_amount: 600,
      loading_started_at: null, loading_daily_dose: null, loading_duration_days: null,
    });
    const app = buildApp();
    const res = await req(app, 'POST', '/api/coach/log', {
      supplement_id: 'supp_whey',
      dosage: 30,
      source: 'in_app',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.remaining_amount).toBe(570);
  });

  it('POST /api/coach/session-end creates a post-workout nudge', async () => {
    insertSupplement({
      id: 'supp_creatine', name: 'Creatine', type: 'creatine',
      dose_amount: 5, dose_unit: 'g',
      conditions: {}, timing_tags: ['post_workout'],
      rationale_short: 's', rationale_long: 'l',
      active: true,
      remaining_amount: 100,
      loading_started_at: null, loading_daily_dose: null, loading_duration_days: null,
    });
    const app = buildApp();
    const res = await req(app, 'POST', '/api/coach/session-end', {
      session_id: 'sess-zzz',
      ended_at: '2026-04-19T13:00:00Z',
    });
    expect(res.status).toBe(201);
    const today = await (await req(app, 'GET', '/api/coach/today')).json();
    expect(today.logged.concat(today.pending).some((n: { nudge_key: string }) => n.nudge_key.includes('post_workout'))).toBe(true);
  });

  it('POST /api/coach/tick is callable and returns counts', async () => {
    const app = buildApp();
    const res = await req(app, 'POST', '/api/coach/tick');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('generated');
    expect(body).toHaveProperty('pushed');
    expect(body).toHaveProperty('expired');
  });

  it('returns 401 without API key', async () => {
    const app = buildApp();
    const res = await app.request('http://test/api/coach/today', { method: 'GET' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npx vitest run test/coach-routes.test.ts`
Expected: FAIL with missing module error.

- [ ] **Step 3: Write the routes**

Create `src/routes/coach.ts`:

```typescript
// src/routes/coach.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ErrorSchema } from '../schemas/shared.js';
import {
  TodayResponseSchema,
  LogRequestSchema,
  LogResponseSchema,
  NudgeKeyBody,
  SessionEndRequestSchema,
  InventoryResponseSchema,
  SupplementSchema,
  SupplementIdParam,
  TickResponseSchema,
  OkResponseSchema,
} from '../schemas/coach.js';
import {
  tick,
  recordSessionEnd,
  logIntake,
  skipNudge,
  laterNudge,
  getToday,
} from '../services/coach.js';
import { getInventory, getSupplement } from '../services/coach-db.js';

const coach = new OpenAPIHono();

const todayRoute = createRoute({
  method: 'get',
  path: '/today',
  tags: ['Coach'],
  summary: "Today's supplement nudges grouped by state",
  responses: {
    200: { description: 'Today', content: { 'application/json': { schema: TodayResponseSchema } } },
  },
});
coach.openapi(todayRoute, async (c) => {
  return c.json(await getToday(new Date()), 200);
});

const logRoute = createRoute({
  method: 'post',
  path: '/log',
  tags: ['Coach'],
  summary: 'Log a supplement intake',
  request: { body: { content: { 'application/json': { schema: LogRequestSchema } } } },
  responses: {
    201: { description: 'Logged', content: { 'application/json': { schema: LogResponseSchema } } },
    400: { description: 'Validation', content: { 'application/json': { schema: ErrorSchema } } },
  },
});
coach.openapi(logRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await logIntake({ ...body });
  return c.json(result, 201);
});

const skipRoute = createRoute({
  method: 'post',
  path: '/skip',
  tags: ['Coach'],
  summary: 'Skip a nudge',
  request: { body: { content: { 'application/json': { schema: NudgeKeyBody } } } },
  responses: { 200: { description: 'Skipped', content: { 'application/json': { schema: OkResponseSchema } } } },
});
coach.openapi(skipRoute, async (c) => {
  await skipNudge(c.req.valid('json'));
  return c.json({ ok: true as const }, 200);
});

const laterRoute = createRoute({
  method: 'post',
  path: '/later',
  tags: ['Coach'],
  summary: 'Reschedule a nudge +2h',
  request: { body: { content: { 'application/json': { schema: NudgeKeyBody } } } },
  responses: { 200: { description: 'Rescheduled', content: { 'application/json': { schema: OkResponseSchema } } } },
});
coach.openapi(laterRoute, async (c) => {
  await laterNudge(c.req.valid('json'));
  return c.json({ ok: true as const }, 200);
});

const sessionEndRoute = createRoute({
  method: 'post',
  path: '/session-end',
  tags: ['Coach'],
  summary: 'Signal that a gym session ended; may push a post-workout nudge',
  request: { body: { content: { 'application/json': { schema: SessionEndRequestSchema } } } },
  responses: { 201: { description: 'Recorded', content: { 'application/json': { schema: OkResponseSchema } } } },
});
coach.openapi(sessionEndRoute, async (c) => {
  await recordSessionEnd(c.req.valid('json'));
  return c.json({ ok: true as const }, 201);
});

const tickRoute = createRoute({
  method: 'post',
  path: '/tick',
  tags: ['Coach'],
  summary: 'Evaluate scheduled nudges; called by Hermes cron',
  responses: { 200: { description: 'Tick result', content: { 'application/json': { schema: TickResponseSchema } } } },
});
coach.openapi(tickRoute, async (c) => {
  const result = await tick({ now: new Date() });
  return c.json(result, 200);
});

const inventoryRoute = createRoute({
  method: 'get',
  path: '/inventory',
  tags: ['Coach'],
  summary: 'Inventory with runout projections',
  responses: { 200: { description: 'Inventory', content: { 'application/json': { schema: InventoryResponseSchema } } } },
});
coach.openapi(inventoryRoute, async (c) => {
  return c.json({ items: getInventory() }, 200);
});

const supplementRoute = createRoute({
  method: 'get',
  path: '/supplement/{id}',
  tags: ['Coach'],
  summary: 'Full catalog row including rationale_long',
  request: { params: SupplementIdParam },
  responses: {
    200: { description: 'Supplement', content: { 'application/json': { schema: SupplementSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
});
coach.openapi(supplementRoute, async (c) => {
  const { id } = c.req.valid('param');
  const s = getSupplement(id);
  if (!s) return c.json({ error: { code: 'not_found', message: 'supplement not found', request_id: c.get('requestId') ?? '' } }, 404);
  return c.json(s, 200);
});

export default coach;
```

- [ ] **Step 4: Mount in `route-publication.ts`**

Add import with the other route imports:

```typescript
import coach from './routes/coach.js';
```

Add entry to `apiRouteMounts` array (before the closing `] as const;`):

```typescript
  { path: '/api/coach', route: coach },
```

Add entry to `caddyRouteMatchers`:

```typescript
  '/api/coach',
  '/api/coach/*',
```

- [ ] **Step 5: Run route tests**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npx vitest run test/coach-routes.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Full test run**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && npm test`
Expected: all tests PASS (previous tests still green).

- [ ] **Step 7: Commit in jimbo-api**

```bash
cd /Users/marvinbarretto/development/jimbo/jimbo-api
git add src/routes/coach.ts src/route-publication.ts test/coach-routes.test.ts
git commit -m "feat: mount /api/coach routes"
```

---

### Task 8: Coach seed script

**Files:**
- Create: `/Users/marvinbarretto/development/jimbo/jimbo-api/scripts/seed-coach.ts`
- Modify: `/Users/marvinbarretto/development/jimbo/jimbo-api/package.json` (add `seed:coach` script)

- [ ] **Step 1: Create the seed script**

Create `scripts/seed-coach.ts`:

```typescript
// scripts/seed-coach.ts
// Seeds Marvin's actual supplement inventory and protocol.
// Idempotent: clears coach_supplements and re-inserts. Safe to rerun.
import { getDb } from '../src/db/index.js';
import { insertSupplement } from '../src/services/coach-db.js';
import type { SupplementInsert } from '../src/services/coach-db.js';

const SUPPLEMENTS: SupplementInsert[] = [
  {
    id: 'supp_whey',
    name: 'Whey Protein',
    type: 'protein',
    dose_amount: 30,
    dose_unit: 'g',
    conditions: {},
    timing_tags: ['post_workout', 'rest_day_fallback'],
    rationale_short: 'Fast-absorbed protein for muscle repair and synthesis.',
    rationale_long: [
      '## Whey Protein',
      '',
      '**What it does:** Supplies the amino acids your muscles use to repair and grow after training.',
      'Whey is digested faster than casein or plant proteins — peak blood amino acids in ~90 min.',
      '',
      '**Why 30g:** Studies show ~25-40g per dose maximises muscle protein synthesis in adults.',
      'Less than ~20g under-stimulates; much more is fine but offers diminishing returns per dose.',
      '',
      '**Timing:** The 30-minute post-workout window is widely cited but overstated. What matters most is **daily total protein** (~1.6-2.0g/kg bodyweight). Post-workout is convenient and uses the time you\'re thinking about it — that\'s the real value.',
      '',
      '**If you skip:** Hit your daily protein with food. A scoop missed is not a crisis.',
    ].join('\n'),
    active: true,
    remaining_amount: 900,
    loading_started_at: null, loading_daily_dose: null, loading_duration_days: null,
  },
  {
    id: 'supp_creatine',
    name: 'Creatine Monohydrate',
    type: 'creatine',
    dose_amount: 5,
    dose_unit: 'g',
    conditions: {},
    timing_tags: ['post_workout', 'rest_day_fallback', 'loading'],
    rationale_short: 'Saturates muscle creatine stores for strength + power output.',
    rationale_long: [
      '## Creatine Monohydrate',
      '',
      '**What it does:** Creatine tops up your muscles\' phosphocreatine stores, the energy system used for short, hard efforts (lifts, sprints, first few reps of a set).',
      'More phosphocreatine = one or two extra reps per set = more training stimulus over weeks.',
      '',
      '**Why 5g:** Studies converge on 3-5g/day for maintenance. Cheap, well-researched.',
      '',
      '**Loading phase:** 20g/day split into four 5g doses for 5 days saturates stores in a week instead of three. After loading, drop to 5g/day maintenance.',
      '',
      '**Timing:** Doesn\'t matter long-term. Taking it post-workout is pure convenience — it piggybacks on whey.',
      '',
      '**Effects you may notice:** After 2-3 weeks, slightly more reps at the same weight. Small (1-2kg) water-weight gain early on — that\'s intracellular water, not bloat.',
    ].join('\n'),
    active: true,
    remaining_amount: 500,
    loading_started_at: '2026-04-19',
    loading_daily_dose: 20,
    loading_duration_days: 5,
  },
  {
    id: 'supp_vit_d3',
    name: 'Vitamin D3',
    type: 'vitamin',
    dose_amount: 1,
    dose_unit: 'tablet',
    conditions: { needs_food: true },
    timing_tags: ['morning'],
    rationale_short: 'Fat-soluble. Hormone-adjacent. UK winters = deficiency risk.',
    rationale_long: [
      '## Vitamin D3 (Holland & Barrett, 25μg)',
      '',
      '**What it does:** Vitamin D regulates calcium absorption and hundreds of downstream immune and mood-adjacent processes. More like a hormone than a vitamin.',
      '',
      '**Why 25μg (1000 IU):** A conservative daily amount. The UK NHS recommends 10μg/day minimum in winter; 25μg/day is common practice for people who don\'t get much sun.',
      '',
      '**Needs food:** Fat-soluble — absorbs ~50% better alongside dietary fat. Empty-stomach doses are largely wasted.',
      '',
      '**If you skip:** Delay until you eat. Skip the day entirely if you don\'t eat — consistency over weeks matters, not any single dose.',
    ].join('\n'),
    active: true,
    remaining_amount: 60,
    loading_started_at: null, loading_daily_dose: null, loading_duration_days: null,
  },
  {
    id: 'supp_centrum',
    name: 'Centrum Advance 50+ Multivitamin',
    type: 'vitamin',
    dose_amount: 1,
    dose_unit: 'tablet',
    conditions: { needs_food: true },
    timing_tags: ['morning'],
    rationale_short: 'Micronutrient floor — covers gaps in day-to-day diet.',
    rationale_long: [
      '## Centrum Advance 50+ Multivitamin',
      '',
      '**What it does:** One tablet contains small-to-moderate doses of ~25 vitamins and minerals. Think of it as insurance against low-variety meals or iron/B-vitamin shortfalls.',
      '',
      '**Why 50+ formula:** Higher in B12, D, and B6 than standard multis, at lower iron — matches typical needs for adults over 50 but is also fine earlier. (If you\'re under 40 and eat red meat, a regular multi would be equally fine.)',
      '',
      '**Needs food:** Iron and zinc in a multi on an empty stomach often causes nausea. With food = no issue.',
      '',
      '**If you skip:** Not a crisis. Daily habit beats perfect timing. Skip rather than take on empty stomach.',
    ].join('\n'),
    active: true,
    remaining_amount: 90,
    loading_started_at: null, loading_daily_dose: null, loading_duration_days: null,
  },
  {
    id: 'supp_zma',
    name: 'ZMA',
    type: 'other',
    dose_amount: 1,
    dose_unit: 'tablet',
    conditions: { avoid_food: true, min_gap_from_food_min: 30 },
    timing_tags: ['bedtime'],
    rationale_short: 'Zinc + magnesium + B6 for sleep quality and recovery.',
    rationale_long: [
      '## ZMA',
      '',
      '**What it does:** Combines zinc, magnesium aspartate, and vitamin B6. Zinc supports immune function and testosterone; magnesium aids muscle relaxation and sleep; B6 helps neurotransmitter synthesis (dopamine, serotonin).',
      '',
      '**Why bedtime:** Magnesium has a mildly calming effect; many people find ZMA helps them fall asleep faster and wake less.',
      '',
      '**Avoid food:** Calcium and iron in food compete with zinc for absorption. Leave a 30-minute gap after your last meal — otherwise you\'re not really absorbing the zinc.',
      '',
      '**If you skip:** Fine. ZMA is a small boost, not a foundation. Skipping nights here and there doesn\'t matter.',
      '',
      '**Note:** ZMA contains ~450mg magnesium already — do not stack with standalone magnesium tablets.',
    ].join('\n'),
    active: true,
    remaining_amount: 90,
    loading_started_at: null, loading_daily_dose: null, loading_duration_days: null,
  },
];

async function main() {
  const db = getDb();
  db.exec('DELETE FROM coach_supplements');
  for (const s of SUPPLEMENTS) {
    insertSupplement(s);
    console.log(`[ok] seeded ${s.id} — ${s.name}`);
  }
  console.log(`\nSeeded ${SUPPLEMENTS.length} supplements.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script to `package.json`**

In `package.json` under `"scripts"`, add:

```json
"seed:coach": "tsx scripts/seed-coach.ts"
```

- [ ] **Step 3: Smoke-test the seed locally**

Run: `cd /Users/marvinbarretto/development/jimbo/jimbo-api && CONTEXT_DB_PATH=/tmp/coach-seed-test.db npm run seed:coach`
Expected: prints five `[ok] seeded` lines and "Seeded 5 supplements."

- [ ] **Step 4: Commit in jimbo-api**

```bash
cd /Users/marvinbarretto/development/jimbo/jimbo-api
git add scripts/seed-coach.ts package.json
git commit -m "feat: add coach seed script with Marvin's supplement protocol"
```

---

## Phase 2 — Gym PWA Thin Client

### Task 9: Drop unused gym supplements schema

**Files (gym repo):**
- Create: `supabase/migrations/20260419000001_drop_gym_supplements.sql`
- Modify: `scripts/seed-gym-data.ts`
- Modify: `scripts/seed-interview-prompt.md`
- Regenerate: `src/lib/supabase/types.ts`

- [ ] **Step 1: Create the drop migration**

Create `supabase/migrations/20260419000001_drop_gym_supplements.sql`:

```sql
-- Drops the unused supplements schema. Supplement coach moves to jimbo-api.
-- See docs/superpowers/specs/2026-04-18-supplement-coach-design.md.

DROP INDEX IF EXISTS gym.idx_supplement_logs_user;
DROP TABLE IF EXISTS gym.supplement_logs;
DROP TABLE IF EXISTS gym.supplements;
```

- [ ] **Step 2: Remove supplements from `scripts/seed-gym-data.ts`**

Open the file. Delete these regions (line numbers approximate — match by content):

- The `SUPPLEMENTS_DATA` constant (around lines 105-111), including the type annotation line.
- The "Supplements" preview log block (around lines 185-188).
- The "Insert supplements" block (around lines 238-251, ending at `console.log(`[ok] supplements created ...`).

Verify the remaining script still compiles:

Run: `cd /Users/marvinbarretto/development/gym && npx tsc --noEmit scripts/seed-gym-data.ts`
Expected: no errors. If the script references `SUPPLEMENTS_DATA` elsewhere, remove those usages too.

- [ ] **Step 3: Remove supplements from `scripts/seed-interview-prompt.md`**

Open the file. Delete:

- Item 3 in the numbered "What I need from you" list: "Supplements I have at home — name, type ..."
- The `SUPPLEMENTS_DATA` code block in the output template.

- [ ] **Step 4: Regenerate Supabase types**

Run: `cd /Users/marvinbarretto/development/gym && npx supabase gen types --lang=typescript --schema=gym,public > src/lib/supabase/types.ts`

(If the Supabase CLI isn't configured locally, note this in the commit as "types to be regenerated after DB migration applied" — the CI/deploy step may handle it.)

- [ ] **Step 5: Confirm no remaining references**

Run: grep for remaining references via Grep tool for pattern `supplement` in `src/` and `scripts/`. The only results should be the new `/coach/...` files (to be added in later tasks) and comments; no live code referencing the dropped tables.

- [ ] **Step 6: Commit in gym**

```bash
cd /Users/marvinbarretto/development/gym
git add supabase/migrations/20260419000001_drop_gym_supplements.sql \
        scripts/seed-gym-data.ts scripts/seed-interview-prompt.md \
        src/lib/supabase/types.ts
git commit -m "refactor: drop unused gym supplements schema (moved to jimbo-api coach)"
```

---

### Task 10: Gym PWA coach proxy route

**Files (gym repo):**
- Create: `src/app/api/coach/[...path]/route.ts`
- Create: `src/app/api/coach/[...path]/route.test.ts`

Thin forwarder. Attaches `X-API-Key` server-side, forwards method/body to `${JIMBO_API_URL}/api/coach/<path>`. Uses Supabase session to gate access (gym is Marvin-only for now; any authenticated user is allowed).

- [ ] **Step 1: Write the failing test**

Create `src/app/api/coach/[...path]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('JIMBO_API_URL', 'https://jimbo.test');
vi.stubEnv('JIMBO_API_KEY', 'secret');

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  }),
}));

const { GET, POST } = await import('./route');

function req(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('coach proxy route', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('forwards GET /api/coach/today with X-API-Key attached', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ pending: [] }), { status: 200 }));
    const res = await GET(req('GET', 'http://local/api/coach/today'), { params: Promise.resolve({ path: ['today'] }) });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('https://jimbo.test/api/coach/today');
    expect((call[1] as RequestInit).headers).toMatchObject({ 'X-API-Key': 'secret' });
  });

  it('forwards POST /api/coach/log with body', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ log_id: 1, remaining_amount: 500 }), { status: 201 }));
    const res = await POST(req('POST', 'http://local/api/coach/log', { supplement_id: 'supp_x', dosage: 5, source: 'in_app' }), { params: Promise.resolve({ path: ['log'] }) });
    expect(res.status).toBe(201);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toContain('supp_x');
  });

  it('returns 401 when there is no authenticated user', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }),
    }));
    vi.resetModules();
    const { GET: GetFresh } = await import('./route');
    const res = await GetFresh(req('GET', 'http://local/api/coach/today'), { params: Promise.resolve({ path: ['today'] }) });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `cd /Users/marvinbarretto/development/gym && npx vitest run src/app/api/coach/[...path]/route.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/coach/[...path]/route.ts`:

```typescript
// src/app/api/coach/[...path]/route.ts
// Proxy to jimbo-api. Attaches X-API-Key server-side so it never leaks to browser.
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ path: string[] }> }

async function proxy(req: Request, params: Params['params']): Promise<Response> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
  }

  const base = process.env.JIMBO_API_URL
  const key = process.env.JIMBO_API_KEY
  if (!base || !key) {
    return new Response(JSON.stringify({ error: 'jimbo_api_not_configured' }), { status: 500 })
  }

  const { path } = await params
  const targetUrl = `${base}/api/coach/${path.join('/')}`

  const init: RequestInit = {
    method: req.method,
    headers: {
      'X-API-Key': key,
      'Content-Type': 'application/json',
    },
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text()
  }

  const upstream = await fetch(targetUrl, init)
  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}

export async function GET(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
export async function POST(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
export async function PATCH(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
export async function DELETE(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/marvinbarretto/development/gym && npx vitest run src/app/api/coach/[...path]/route.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit in gym**

```bash
cd /Users/marvinbarretto/development/gym
git add src/app/api/coach
git commit -m "feat: add gym-side proxy for jimbo coach api"
```

---

### Task 11: Coach today page

**Files (gym repo):**
- Create: `src/app/coach/today/page.tsx`
- Create: `src/app/coach/today/page.module.scss`
- Create: `src/app/coach/today/coach-today-client.tsx`

Page pattern: Server component fetches `GET /api/coach/today` (through the proxy — same-origin fetch), hands data to a client component for tap handlers.

- [ ] **Step 1: Server component**

Create `src/app/coach/today/page.tsx`:

```tsx
// src/app/coach/today/page.tsx
import { cookies } from 'next/headers'
import { CoachTodayClient, type CoachToday } from './coach-today-client'
import styles from './page.module.scss'

export const dynamic = 'force-dynamic'

async function fetchToday(): Promise<CoachToday> {
  const cookieHeader = (await cookies()).toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/coach/today`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`coach/today ${res.status}`)
  return res.json()
}

export default async function CoachTodayPage() {
  const today = await fetchToday()
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Today&rsquo;s stack</h1>
      <p className={styles.date}>{today.date}</p>
      <CoachTodayClient initial={today} />
    </main>
  )
}
```

Create `src/app/coach/today/page.module.scss`:

```scss
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.heading {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.date {
  color: var(--muted, #666);
  margin: 0 0 1.5rem;
}
```

- [ ] **Step 2: Client component**

Create `src/app/coach/today/coach-today-client.tsx`:

```tsx
// src/app/coach/today/coach-today-client.tsx
'use client'
import { useState, useTransition } from 'react'
import styles from './page.module.scss'

interface Snap {
  supplement_id: string
  name: string
  dose_amount: number
  dose_unit: string
  rationale_short: string
}

interface Nudge {
  nudge_key: string
  anchor: string
  supplements: Snap[]
  scheduled_for: string
  state: 'pending' | 'logged' | 'skipped' | 'expired'
}

export interface CoachToday {
  date: string
  pending: Nudge[]
  logged: Nudge[]
  skipped: Nudge[]
}

const ANCHOR_LABELS: Record<string, string> = {
  morning: 'Morning',
  post_workout: 'Post-workout',
  rest_day_fallback: 'Daily',
  bedtime: 'Bedtime',
  loading: 'Creatine loading',
}

async function postAction(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

export function CoachTodayClient({ initial }: { initial: CoachToday }) {
  const [data, setData] = useState(initial)
  const [, startTransition] = useTransition()

  async function refresh() {
    const res = await fetch('/api/coach/today', { cache: 'no-store' })
    if (res.ok) setData(await res.json())
  }

  async function logAll(nudge: Nudge) {
    for (const s of nudge.supplements) {
      await postAction('/api/coach/log', {
        supplement_id: s.supplement_id,
        dosage: s.dose_amount,
        source: 'in_app',
        nudge_key: nudge.nudge_key,
      })
    }
    startTransition(refresh)
  }

  async function skip(nudge: Nudge) {
    await postAction('/api/coach/skip', { nudge_key: nudge.nudge_key })
    startTransition(refresh)
  }

  async function later(nudge: Nudge) {
    await postAction('/api/coach/later', { nudge_key: nudge.nudge_key })
    startTransition(refresh)
  }

  return (
    <div>
      <Section title="Pending" nudges={data.pending} onTaken={logAll} onSkip={skip} onLater={later} />
      <Section title="Logged" nudges={data.logged} readOnly />
      <Section title="Skipped" nudges={data.skipped} readOnly />
    </div>
  )
}

function Section({ title, nudges, onTaken, onSkip, onLater, readOnly }: {
  title: string
  nudges: Nudge[]
  onTaken?: (n: Nudge) => void
  onSkip?: (n: Nudge) => void
  onLater?: (n: Nudge) => void
  readOnly?: boolean
}) {
  if (nudges.length === 0) return null
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>{title}</h2>
      {nudges.map(n => (
        <article key={n.nudge_key} id={`nudge=${n.nudge_key}`} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: 8, margin: '0.75rem 0' }}>
          <h3 style={{ margin: 0 }}>{ANCHOR_LABELS[n.anchor] ?? n.anchor}</h3>
          <ul>
            {n.supplements.map(s => (
              <li key={s.supplement_id}>
                <a href={`/coach/supplement/${s.supplement_id}`}><strong>{s.name}</strong></a> — {s.dose_amount}{s.dose_unit}
                <div style={{ color: '#555', fontSize: '0.9em' }}>{s.rationale_short}</div>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={() => onTaken?.(n)}>Taken ✓</button>
              <button onClick={() => onLater?.(n)}>Later (+2h)</button>
              <button onClick={() => onSkip?.(n)}>Skip</button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
```

- [ ] **Step 3: Manual smoke (after deploy)**

Skip for now — requires live Jimbo. Integration tested in Task 17.

- [ ] **Step 4: Commit in gym**

```bash
cd /Users/marvinbarretto/development/gym
git add src/app/coach/today
git commit -m "feat: add /coach/today page"
```

---

### Task 12: Coach supplement detail page

**Files (gym repo):**
- Create: `src/app/coach/supplement/[id]/page.tsx`
- Create: `src/app/coach/supplement/[id]/page.module.scss`

- [ ] **Step 1: Page component**

Create `src/app/coach/supplement/[id]/page.tsx`:

```tsx
// src/app/coach/supplement/[id]/page.tsx
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import styles from './page.module.scss'

export const dynamic = 'force-dynamic'

interface Supp {
  id: string
  name: string
  type: string
  dose_amount: number
  dose_unit: string
  rationale_short: string
  rationale_long: string
  remaining_amount: number | null
  loading_started_at: string | null
  loading_daily_dose: number | null
  loading_duration_days: number | null
}

async function fetchSupplement(id: string): Promise<Supp | null> {
  const cookieHeader = (await cookies()).toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/coach/supplement/${id}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`coach/supplement ${res.status}`)
  return res.json()
}

export default async function SupplementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supp = await fetchSupplement(id)
  if (!supp) notFound()

  return (
    <main className={styles.page}>
      <a href="/coach/today" className={styles.back}>&larr; back to today</a>
      <h1>{supp.name}</h1>
      <p className={styles.tagline}>{supp.rationale_short}</p>

      <dl className={styles.facts}>
        <dt>Dose</dt><dd>{supp.dose_amount}{supp.dose_unit}</dd>
        {supp.remaining_amount !== null && (<><dt>Remaining</dt><dd>{supp.remaining_amount}{supp.dose_unit}</dd></>)}
        {supp.loading_started_at && (<><dt>Loading started</dt><dd>{supp.loading_started_at}</dd></>)}
      </dl>

      <article className={styles.body}>
        <ReactMarkdown>{supp.rationale_long}</ReactMarkdown>
      </article>
    </main>
  )
}
```

Create `src/app/coach/supplement/[id]/page.module.scss`:

```scss
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.back {
  display: inline-block;
  color: var(--muted, #666);
  text-decoration: none;
  margin-bottom: 1rem;
}

.tagline {
  color: var(--muted, #666);
  font-size: 1.05rem;
  margin: 0.25rem 0 1.5rem;
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 1rem;
  margin: 1rem 0 2rem;
  dt { font-weight: 600; }
  dd { margin: 0; }
}

.body {
  line-height: 1.6;
  h2, h3 { margin-top: 1.5rem; }
}
```

- [ ] **Step 2: Install react-markdown if needed**

Run: `cd /Users/marvinbarretto/development/gym && npm ls react-markdown 2>&1 | head -3`
Expected: shows version, or "not installed".
If not installed: `npm install react-markdown`

- [ ] **Step 3: Commit in gym**

```bash
cd /Users/marvinbarretto/development/gym
git add src/app/coach/supplement package.json package-lock.json
git commit -m "feat: add /coach/supplement/[id] teaching page"
```

---

### Task 13: Wire session-end to jimbo coach

**Files (gym repo):**
- Modify: `src/lib/db/sessions.ts` (extend `endSession` to fire-and-forget a notify call)
- Create: `src/lib/coach/session-end.ts`
- Create: `src/lib/coach/session-end.test.ts`

We don't call jimbo directly from `endSession` (it's shared between server contexts). Instead, add a helper `notifyCoachSessionEnd` that fires-and-forgets a POST to the gym proxy. Call it from wherever `endSession` is invoked in the app flow. (Identify callers via grep in Step 4.)

- [ ] **Step 1: Write the failing test for the helper**

Create `src/lib/coach/session-end.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn()
globalThis.fetch = fetchMock as unknown as typeof fetch

const { notifyCoachSessionEnd } = await import('./session-end')

describe('notifyCoachSessionEnd', () => {
  beforeEach(() => fetchMock.mockReset())

  it('POSTs session_id and ended_at to /api/coach/session-end', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }))
    await notifyCoachSessionEnd({ sessionId: 'sess-1', endedAt: '2026-04-19T13:00:00Z' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/coach/session-end')
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      session_id: 'sess-1',
      ended_at: '2026-04-19T13:00:00Z',
    })
  })

  it('swallows errors so session-end never fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'))
    await expect(notifyCoachSessionEnd({ sessionId: 's', endedAt: 'x' })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify fail**

Run: `cd /Users/marvinbarretto/development/gym && npx vitest run src/lib/coach/session-end.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the helper**

Create `src/lib/coach/session-end.ts`:

```typescript
// src/lib/coach/session-end.ts
// Fire-and-forget notifier. Must never throw — session-end is the primary op.

export async function notifyCoachSessionEnd(opts: { sessionId: string; endedAt: string }): Promise<void> {
  try {
    await fetch('/api/coach/session-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: opts.sessionId, ended_at: opts.endedAt }),
    })
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Hook the helper into existing end-session flow**

Run: Grep tool for pattern `endSession\(` in `src/` to find callers.
For each caller that runs in a **client context** (React components, client-only hooks), after the `endSession` success path, add:

```typescript
import { notifyCoachSessionEnd } from '@/lib/coach/session-end'
// ...
await notifyCoachSessionEnd({ sessionId: session.id, endedAt: session.ended_at ?? new Date().toISOString() })
```

Do not call from the server-side `lib/db/sessions.ts` itself — `fetch('/api/...')` uses a relative URL and needs a browser or configured server fetch. The helper is intended to be called from the client after the user ends a session.

If no client caller exists yet (end-session is driven from a server action only), add the helper call next to the server action's success return, but use the absolute URL built from `process.env.NEXT_PUBLIC_APP_URL`. Document the change in the commit.

- [ ] **Step 5: Run tests**

Run: `cd /Users/marvinbarretto/development/gym && npx vitest run src/lib/coach`
Expected: helper tests PASS.

Run the full unit suite to check for regressions:

Run: `cd /Users/marvinbarretto/development/gym && npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit in gym**

```bash
cd /Users/marvinbarretto/development/gym
git add src/lib/coach src/app  # or wherever the caller lives
git commit -m "feat: notify jimbo coach on gym session end"
```

---

## Phase 3 — Hermes Wiring

### Task 14: Add `coach-tick` command to `jimbo-api.sh`

**Files (hermes repo):**
- Modify: `/Users/marvinbarretto/development/hub/hermes/mcp-servers/jimbo-api.sh`

- [ ] **Step 1: Read the file** to find the `case` statement dispatch.

Run: Read the file, locate the `case` inside the main dispatch. Existing commands look like:
```sh
vault)          call "/api/vault/notes?..." ;;
```

- [ ] **Step 2: Verify there's a `post` helper function in the script**. If there isn't, the existing `call` (GET) can be adapted; check the script contents for the HTTP helper.

- [ ] **Step 3: Add the `coach-tick` case**

Insert a new case branch alongside existing commands:

```sh
coach-tick)     post "/api/coach/tick" "{}" ;;
```

If `post` doesn't exist but a similar helper does (e.g., `patch`), model the new case after the POST pattern used in, for example, `dispatch-enqueue` or `email-report-create`.

- [ ] **Step 4: Test the command locally** (requires live jimbo-api)

Run: `JIMBO_API_KEY=<your-key> JIMBO_API_URL=http://localhost:3100 /Users/marvinbarretto/development/hub/hermes/mcp-servers/jimbo-api.sh coach-tick`
Expected: JSON output like `{"generated":0,"pushed":0,"expired":0}` (assuming no pending nudges yet).

- [ ] **Step 5: Commit in hermes**

```bash
cd /Users/marvinbarretto/development/hub/hermes
git add mcp-servers/jimbo-api.sh
git commit -m "feat: add coach-tick command to jimbo-api wrapper"
```

---

### Task 15: Create `supplement-coach` Hermes skill

**Files (hermes repo):**
- Create: `/Users/marvinbarretto/development/hub/hermes/skills/supplement-coach/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
---
name: supplement-coach
description: Tick the Jimbo supplement coach on schedule. All evaluation logic lives in jimbo-api. Dumb trigger — idempotent at the API side.
---

# Supplement Coach Tick

## Action

Run `jimbo-api coach-tick`. Report the returned counts succinctly, e.g. "1 pushed, 2 generated, 0 expired" — or "no-op" if all counts are zero.

Jimbo evaluates scheduled nudges, pushes Telegram directly via its own `sendTelegram` service, and updates state. This skill is a dumb trigger. If the tick fails, the next one (≤30 min later) catches up. Evaluation is idempotent via `INSERT OR IGNORE ON nudge_key`.

## Do NOT

- Do not format or send Telegram messages yourself — Jimbo does that.
- Do not query `/api/coach/today` to summarise. Just tick and report counts.
- Do not retry on failure. Log and move on.
```

- [ ] **Step 2: Commit in hermes**

```bash
cd /Users/marvinbarretto/development/hub/hermes
git add skills/supplement-coach
git commit -m "feat: add supplement-coach skill"
```

---

### Task 16: Register the Hermes cron job

**Not a file-editing task** — registration mutates VPS runtime state (`/home/jimbo/.hermes/cron/jobs.json`). Documented as a runbook step.

- [ ] **Step 1: Deploy hermes config**

Run: `cd /Users/marvinbarretto/development/hub && ./hermes/hermes-push.sh`
Expected: rsync completes without errors.

- [ ] **Step 2: Register the cron job**

Run: `ssh jimbo 'su - jimbo -c "hermes cron create \"every 30m\" \"Run a coach tick\" --skill supplement-coach --skill jimbo-api --name supplement-coach-tick --deliver silent"'`
Expected: prints the created job entry.

- [ ] **Step 3: Verify the job is registered**

Run: `ssh jimbo 'su - jimbo -c "hermes cron list"'`
Expected: `supplement-coach-tick` appears with status active.

- [ ] **Step 4: Manually trigger once to smoke-test**

Run: `ssh jimbo 'su - jimbo -c "hermes cron run supplement-coach-tick"'`
Expected: completes without error; if a scheduled nudge is ready, a Telegram arrives; otherwise silent.

---

## Phase 4 — End-to-End Smoke

### Task 17: End-to-end integration smoke test

**Runtime check — no file changes.** Uses live Jimbo + gym PWA + Telegram.

- [ ] **Step 1: Deploy jimbo-api to the VPS**

Follow Jimbo's existing deployment flow: `npm run build` locally, `rsync` to VPS (see `jimbo-api/docs/deployment.md`), `systemctl restart jimbo-api`.

Verify: `ssh jimbo 'curl -s http://localhost:3100/api/coach/today -H "X-API-Key: $JIMBO_API_KEY"'`
Expected: `{"date":"2026-04-19","pending":[],"logged":[],"skipped":[]}` (or similar with real date).

- [ ] **Step 2: Seed Jimbo's coach data**

Run: `ssh jimbo 'cd /home/jimbo/jimbo-api && npm run seed:coach'`
Expected: five supplements seeded.

Verify inventory: `ssh jimbo 'curl -s http://localhost:3100/api/coach/inventory -H "X-API-Key: $JIMBO_API_KEY"'`
Expected: `items` array of five supplements with `remaining_amount` populated.

- [ ] **Step 3: Deploy gym PWA**

Follow existing gym deploy flow (Vercel or equivalent). Confirm env vars `JIMBO_API_URL` and `JIMBO_API_KEY` are set for production.

- [ ] **Step 4: Exercise the happy path**

1. Log in to gym PWA.
2. Start a session, log a couple of sets, end the session.
3. **Expected within ~5 seconds:** Telegram arrives with post-workout stack (whey + creatine) and a deep-link to `/coach/today#nudge=...`.
4. Tap the deep-link. Gym PWA opens at `/coach/today`. Nudge appears in "Pending".
5. Tap "Taken ✓". Nudge moves to "Logged". Inventory decrements.
6. Open `/coach/supplement/supp_whey`. Teaching page renders the markdown from `rationale_long`.

- [ ] **Step 5: Exercise the morning schedule**

Wait until the next Hermes tick crosses 09:00 (or manually trigger `hermes cron run supplement-coach-tick` once before 09:00 and once after).
**Expected:** one Telegram with D3 + Centrum morning stack after 09:00.

- [ ] **Step 6: Verify vault emission**

Run: `ssh jimbo 'curl -s "http://localhost:3100/api/vault/notes?search=supplement&limit=5" -H "X-API-Key: $JIMBO_API_KEY"'`
Expected: recent note(s) with type `gym.supplement.taken` (if vault emission was implemented — otherwise skip this step and raise it as follow-up).

**Note:** vault emission was designed but not added to the coach orchestration in Task 6. If this smoke step fails, it's an expected gap — the spec lists "Vault emission" as a minor follow-up. Raise a follow-up to add an `emitToVault` call inside `logIntake` after `insertLog` succeeds.

- [ ] **Step 7: Document any issues as GitHub issues** (or inline tasks)

Any flakiness, missing features, or unclear UX observed during smoke → capture as follow-ups. Do not fix mid-smoke.

---

## Self-Review Notes

**Spec coverage:** Every spec section has a task:
- Jimbo schema → Task 1
- Types + Zod → Tasks 2, 3
- Rule evaluation (R1, R2, R3, rest-day, loading) → Task 4
- DB helpers → Task 5
- Orchestration (tick, session-end, log/skip/later) → Task 6
- Routes → Task 7
- Seed (real inventory + teaching copy) → Task 8
- Gym dead-code drop (R-spec "gym cleanup") → Task 9
- Gym proxy → Task 10
- /coach/today (teaching-heavy display) → Task 11
- /coach/supplement/:id (tap-through) → Task 12
- Session-end hook → Task 13
- Hermes CLI command + skill + cron → Tasks 14-16
- End-to-end smoke → Task 17

**Gap knowingly deferred:** Vault emission on `logIntake` — called out explicitly in Task 17 Step 6 so it gets raised as a follow-up after the first green smoke.

**Gap in Task 13:** The exact caller-side integration point for `notifyCoachSessionEnd` depends on current gym UI code (grep step). If there's no client-driven end-session yet, the worker should add one as part of this task or raise it.
