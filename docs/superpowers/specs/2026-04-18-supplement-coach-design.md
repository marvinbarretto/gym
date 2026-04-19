# Supplement Coach Design

## Goal

Build a supplement/nutrition coach that teaches Marvin what to take and why, nudges him at the right moments via Telegram, and logs intake. Coach lives in **jimbo-api** (not the gym PWA) because it reuses Jimbo's existing Telegram sender, cron pattern, briefing engine, and vault. The gym PWA is a thin client for interaction and session-end signalling.

## Why Now

- Marvin has supplements at home (D3, Centrum multivit, creatine, ZMA, whey) but doesn't take them consistently. Missed gym sessions are partly attributed to recovery/energy — supplements may help, but only if actually taken.
- No existing app surface logs or schedules supplement intake. Seeded inventory in `gym/supabase` is unused dead code.
- The coach is fundamentally a *personal-assistant* feature (schedule → nudge → log → teach), not a gym-specific feature. It belongs in the personal hub.

## Design Principles

1. **Teaching is the product.** Every nudge carries a short "why." The gym PWA has a tap-through page per supplement with a full explanation (mechanism, benefit, timing nuance, what happens if skipped). Repetition is deliberate — reinforcement is the point.
2. **Triggers are conditions, not clock times.** "With first meal" ≠ "at 09:00." Nudges fire at loose anchors; messages carry conditional logic ("take when you next eat — skip today if you don't"). Intake time decouples from nudge time.
3. **Jimbo owns orchestration. Gym owns UI + session events.** Jimbo stores protocol, inventory, logs, and state. Gym PWA renders and captures taps. Hermes is a dumb cron trigger.
4. **Rules are declarative.** Conditions and timing are data (JSONB on supplement rows), not code. Protocol editable via SQL/script without touching app logic.
5. **Smartness is composable.** Coach starts with base protocol + a small set of rules (post-workout trigger, creatine loading, rest-day fallback, inventory countdown, adherence gap). Each rule is independently valuable and can be added/removed.

## Architecture

```
Cron (every 30m)          Session ended                  User taps "Taken"
Hermes                    Gym PWA                        Gym PWA
  │                         │                              │
  │ POST /api/coach/tick    │ POST /api/coach/session-end  │ tap deep-link
  ▼                         ▼                              ▼
Jimbo: evaluate          Jimbo: create post-workout     Gym PWA page
  │ rules                 │ nudge, push immediately     /coach/today
  ▼                         ▼                              │
sendTelegram             sendTelegram                   POST /api/coach/log
(existing service)       (existing service)            (gym proxy → Jimbo)
  │                         │                              │
  ▼                         ▼                              ▼
Telegram                 Telegram                      Jimbo: write log,
                                                       decrement inventory,
                                                       mark nudge logged,
                                                       emit to vault
```

## Protocol Content

Starting protocol — editable per user via SQL or a seed script.

| Anchor | Trigger | Items | Conditions | Rationale (short) |
|---|---|---|---|---|
| Morning | Scheduled ~09:00 | D3 (1 tablet), Centrum (1 tablet) | Needs food | Fat-soluble + micronutrient floor. Take with first meal. |
| Post-workout | Event: session ended within 2h | Whey (30g), Creatine (5g) | None | Protein synthesis window. Creatine piggybacks. |
| Rest-day fallback | Scheduled ~14:00, only if no session logged today | Whey (30g), Creatine (5g) | None | Keep daily on non-training days. |
| Bedtime | Scheduled ~22:00 | ZMA (1 tablet) | Avoid food (30min+ gap) | Calcium/iron block Zn absorption. |
| Loading (creatine, first 5 days) | Extra scheduled pushes at 11:00, 14:00, 17:00, 20:00 | Creatine (5g each) | None | Compresses saturation to 5 days vs 3-4 weeks. |

Dropped from seeded inventory: standalone Magnesium tablet (ZMA already contains ~450mg Mg; stacking risks exceeding the 350mg supplemental upper limit).

### Push style

Teaching-heavy, paragraph form. Example morning nudge:

```
D3 + Centrum with first meal.

Why with food: fat-soluble vitamins (D3) absorb ~50% better with dietary fat.
Multivit on empty stomach can cause nausea.

Skipping breakfast? Delay until lunch. Skip the day entirely if no meal —
one miss doesn't matter, consistency over weeks does.

[Tap to log or learn more]
```

Toggle to terse style after 2 weeks is a future extension.

## Jimbo Schema (new tables)

All prefixed `coach_` to avoid collision with existing tables. Jimbo's schema is a single inline `SCHEMA` const in `src/db/index.ts` using `CREATE TABLE IF NOT EXISTS` — so the coach block is appended there. No migration tooling; the statements run on process start and are idempotent.

```sql
CREATE TABLE IF NOT EXISTS coach_supplements (
  id TEXT PRIMARY KEY,                         -- 'supp_' + uuid slice
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('protein','creatine','vitamin','other')),
  dose_amount REAL NOT NULL,
  dose_unit TEXT NOT NULL,                     -- 'g','mg','tablet','scoop'
  conditions TEXT NOT NULL DEFAULT '{}',       -- JSON: {needs_food, avoid_food, min_gap_from_food_min}
  timing_tags TEXT NOT NULL DEFAULT '[]',      -- JSON array: ['morning','post_workout','rest_day_fallback','bedtime','loading']
  rationale_short TEXT NOT NULL,
  rationale_long TEXT NOT NULL,                -- markdown
  active INTEGER NOT NULL DEFAULT 1,
  remaining_amount REAL,                       -- inventory countdown, unit = dose_unit's base (g for whey, tablets for tablets)
  loading_started_at TEXT,                     -- ISO date, creatine only. Loading active iff date('now') < date(loading_started_at, '+' || loading_duration_days || ' days')
  loading_daily_dose REAL,
  loading_duration_days INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Nudges defined before logs because logs.nudge_id references nudges.
CREATE TABLE IF NOT EXISTS coach_nudges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nudge_key TEXT NOT NULL UNIQUE,              -- 'YYYY-MM-DD:anchor' or 'YYYY-MM-DD:post_workout:session-uuid'
  anchor TEXT NOT NULL,                        -- 'morning'|'post_workout'|'rest_day_fallback'|'bedtime'|'loading'
  supplements TEXT NOT NULL,                   -- JSON snapshot: [{supplement_id, dose, conditions, rationale_short}]
  scheduled_for TEXT NOT NULL,                 -- target intake moment (used for display + expiry). Push time recorded in pushed_at.
  pushed_at TEXT,
  delivered_via TEXT,                          -- 'telegram'|'in_app_only'
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

Single-user system. No `user_id` column — consistent with the rest of Jimbo's schema.

## Jimbo Routes (new `/api/coach/*`)

All routes require `X-API-Key` (existing Jimbo auth middleware).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/coach/today` | Today's pending + logged nudges with items. Used by gym PWA to render `/coach/today` page. |
| POST | `/api/coach/log` | Body `{supplement_id, dosage, source, nudge_key?}`. Writes `coach_logs`, decrements `remaining_amount`, marks nudge `logged`. Emits to vault. |
| POST | `/api/coach/skip` | Body `{nudge_key}`. Marks nudge `skipped`. No re-push today. |
| POST | `/api/coach/later` | Body `{nudge_key}`. Reschedules `scheduled_for` +2h, stays `pending`. |
| GET | `/api/coach/inventory` | Returns `[{supplement_id, name, remaining_amount, unit, projected_days_left, reorder_soon}]`. |
| GET | `/api/coach/supplement/:id` | Full catalog row including `rationale_long`. For gym PWA teaching page. |
| POST | `/api/coach/session-end` | Body `{session_id, ended_at}`. Creates a post-workout nudge with `scheduled_for = ended_at + 15min` (the target intake moment) and pushes Telegram immediately — the push doesn't wait for `scheduled_for`, it fires on the event itself. |
| POST | `/api/coach/tick` | No body. Called by Hermes cron every 30min. Jimbo evaluates scheduled triggers, pushes pending nudges to Telegram, updates state. |

### Rule evaluation (service `coach.ts`)

`tick` and `session-end` handlers share core logic:

1. **Generate candidate nudges for today** based on active supplement timing_tags:
   - `morning` → scheduled 09:00
   - `bedtime` → scheduled 22:00
   - `rest_day_fallback` → scheduled 14:00 **if** no post-workout nudge exists for today
   - `loading` → extra pushes at 11:00, 14:00, 17:00, 20:00 if loading is active, where active means `date('now') < date(loading_started_at, '+' || loading_duration_days || ' days')`
2. **Insert into `coach_nudges`** via `INSERT OR IGNORE ON nudge_key` — keeps evaluation idempotent.
3. **For each pending nudge where `scheduled_for <= now` and `pushed_at IS NULL`:**
   - Format teaching-heavy Telegram message with deep-link to gym PWA `/coach/today#nudge=<key>`.
   - `sendTelegram(...)`.
   - Update `pushed_at`, `delivered_via='telegram'`.
4. **Expire stale nudges**: any `pending` with `scheduled_for < now - 12h` transitions to `expired`.

### Vault emission

On each successful `coach/log`, Jimbo writes to its own vault:

```
{
  type: 'gym.supplement.taken',
  tags: ['gym','supplement', supp.name.toLowerCase().replace(/\s+/g,'-')],
  data: {supplement_id, dose, taken_at, source}
}
```

Enables future briefing queries ("supplement adherence this week").

## Gym PWA Changes (thin)

New files:

- `src/app/coach/today/page.tsx` — fetches from gym proxy, renders pending + logged nudges, tap buttons.
- `src/app/coach/supplement/[id]/page.tsx` — teaching tap-through.
- `src/app/api/coach/[...path]/route.ts` — server-side proxy. Forwards to Jimbo with `X-API-Key` (env var `JIMBO_API_KEY`). Supabase session gates access.

Modified:

- `src/lib/stores/gym-store.ts` — in `endSession`, after DB write, call `fetch('/api/coach/session-end', {method:'POST', body: JSON.stringify({session_id, ended_at})})`. Non-blocking — gym session end must not fail if Jimbo is down.

### Environment

Gym PWA already declares `JIMBO_API_URL` and `JIMBO_API_KEY` in `.env.local.example` (for an existing Health Connect fitness-sync integration). The coach proxy reuses these — no new env vars needed. In production these point at `http://localhost:3100` on the VPS if the gym backend colocates with Jimbo, or a public Caddy-fronted URL otherwise.

## Hermes Skill + Cron

Per `hub/hermes/docs/runbook.md`, Hermes cron jobs live in `/home/jimbo/.hermes/cron/jobs.json` on the VPS — runtime state, not version-controlled. The gateway ticks every 60s and runs due jobs. Cron agents can load skills and invoke `jimbo-api.sh` commands.

### Source-controlled pieces

**1. New command in `hub/hermes/mcp-servers/jimbo-api.sh`:**

```sh
coach-tick)     post "/api/coach/tick" "{}" ;;
```

**2. New skill `hub/hermes/skills/supplement-coach/SKILL.md`:**

```markdown
---
name: supplement-coach
description: Tick the Jimbo supplement coach on schedule. All evaluation logic lives in jimbo-api.
---

# Supplement Coach Tick

## Action

Run `jimbo-api coach-tick`. Report the result succinctly.

Jimbo evaluates scheduled nudges, pushes Telegram directly via its own sender, and updates state. This skill is a dumb trigger — if the tick fails, the next one catches up (idempotent).
```

### One-time cron registration

Run once from local machine to register the recurring job on the VPS:

```bash
ssh jimbo 'su - jimbo -c "hermes cron create \"every 30m\" \"Run a coach tick\" \
  --skill supplement-coach --skill jimbo-api \
  --name supplement-coach-tick --deliver silent"'
```

`--deliver silent` — cron completion is not itself a Telegram message; the coach pushes its own messages when there's something to say.

### Failure handling

If the tick fails (network, 5xx), the next tick (≤30min later) catches up. Evaluation is idempotent via `INSERT OR IGNORE ON nudge_key` — no duplicate pushes.

## Gym Dead Code Cleanup

One new migration in the gym repo:

**`supabase/migrations/20260418000001_drop_gym_supplements.sql`**:
```sql
DROP TABLE IF EXISTS gym.supplement_logs;
DROP TABLE IF EXISTS gym.supplements;
```

Delete from `scripts/seed-gym-data.ts`:
- Lines 105-111 — `SUPPLEMENTS_DATA` const
- Lines 185-188 — preview log block
- Lines 239-251 — insert loop

Update `scripts/seed-interview-prompt.md`:
- Remove supplements section from interview flow (item 3 in the "What I need from you" list, plus the `SUPPLEMENTS_DATA` output template).

Regenerate types:
```
supabase gen types --lang=typescript --schema=gym,public > src/lib/supabase/types.ts
```

The real inventory moves to Jimbo — captured in a new `scripts/seed-coach.ts` in jimbo-api, containing the five current supplements plus whey (30g scoop).

## Testing Strategy

### Jimbo

- **Unit tests** for `coach.ts` rule evaluation using fake clock:
  - Morning/bedtime nudges generated at right time, skipped outside window
  - Rest-day fallback fires only when no post-workout nudge exists today
  - Creatine loading fires extra pushes within window, stops after `loading_duration_days`
  - Idempotency: running `tick` twice in a row produces no duplicate nudges
  - Post-workout nudge created on `session-end` with correct `scheduled_for`
- **Integration tests** for the routes using the existing Vitest setup — spin up the Hono app, hit routes with test API key, assert DB state.

### Gym PWA

- **Vitest** for the proxy route — assert it attaches API key and forwards status.
- **Playwright** for `/coach/today` — tap Taken fires the right request, UI updates.
- **Manual** for session-end → Telegram push (requires real Telegram bot in staging).

## Out of Scope

- DOMS-responsive doses (R8) — requires daily check-ins, not currently happening. Revisit once check-in habit exists.
- Sleep-linked ZMA feedback (R9) — no sleep data synced.
- Calendar-aware pre-workout food (R7) — Jimbo has `/google-calendar` but pre-workout **food** advice is out of scope; only supplement pushes are in scope here.
- Admin UI for editing protocol. Edit via SQL or seed script for v1.
- Multi-user. Jimbo is single-user. Gym PWA's multi-user-for-supplements ambition is parked.
- Voice/microphone logging of intake. Tap-based only.
- Toggle between teaching and terse push styles. Teaching-heavy only for v1.
- Casein/cottage cheese / other food-timing reminders. Supplements only.

## Future Extensions

- Briefing integration: morning pulse includes today's stack + adherence streak.
- Adherence analytics: weekly roll-up of skipped vs taken, surface patterns.
- Inventory reorder suggestions tied to Amazon/affiliate deep-links.
- Generalise "coach" beyond supplements — meds, hydration, skincare use the same framework.
- Smart rules layer (R8, R9) once check-in data flows.
- Gym PWA's `body_check_ins` table — currently also unused. Similar dead-code question, but deliberately out of scope for this spec.
