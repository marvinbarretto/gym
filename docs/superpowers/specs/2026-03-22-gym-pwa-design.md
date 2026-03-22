# Gym PWA — Design Spec

## Problem

Marvin joined a gym for the first time. He doesn't know what he's doing, doesn't have a plan, and knows that's not how you get results. He wants an AI-powered personal gym companion that leads him through sessions, captures everything with zero friction, and helps him learn what works over time.

## Core Principles

1. **Zero friction capture** — voice-first input during sessions, big-button fallback when voice isn't practical. Never a form.
2. **AI leads, user follows** — the app tells you what to do, not the other way around. It generates plans, guides you through exercises, and adapts based on your feedback.
3. **Conversational diagnosis** — subjective metrics (RPE, DOMS, energy) are inferred from natural conversation, not self-reported on numeric scales. The AI asks probing questions like a doctor would.
4. **Structured data from unstructured input** — conversations produce clean, queryable records. The conversation log is the raw truth; structured tables are a convergent view.
5. **Personal but not hardcoded** — gym equipment, supplements, preferences, and body stats are all user data. Multi-user ready from day one via RLS.

## Architecture

### Approach: Hybrid — Structured Core, Conversational Capture

The database has a lean normalised schema for essential entities (sessions, exercises, sets, body metrics, supplements). Input is conversational: the AI uses tool calling to write structured records in real time. The conversation is also stored, so the AI can reference context that didn't map to a structured field.

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), PWA manifest, service worker |
| Styling | SCSS / CSS Modules (no Tailwind) |
| AI | Vercel AI SDK v6, tool calling, streaming |
| Voice | Web Speech API (browser-native, free, on-device STT) |
| Database | Supabase Pro (Postgres, RLS, Auth, real-time) |
| Hosting | Vercel |
| Testing | Vitest (unit), Playwright (E2E) |

### Model Routing

Config-driven, swappable via settings UI without redeployment.

| Tier | Model (default) | Use case |
|------|----------------|----------|
| In-session (real-time) | Claude Haiku 4.5 | Voice parsing, set logging, simple follow-ups |
| Post-session (moderate) | Claude Sonnet 4.6 | DOMS diagnosis, session summaries, supplement timing |
| Deep analysis (async) | Claude Opus via Mac `claude -p` | Plan generation, weekly reviews, progress analysis, class recommendations |
| Fallback | Gemini 2.5 Flash | Cheap extraction if primary unavailable |

Other models to benchmark: Kimi K2, DeepSeek V3.

#### Opus Async Queue

Opus runs on the local Mac (Max subscription, $0 API cost). A `pending_tasks` table in Supabase holds work items. A Mac launchd job fires on wake/interval, pulls pending tasks, runs `claude -p`, writes results back to Supabase. The PWA picks up completed tasks via polling or Supabase real-time.

#### Cost Tracking

Every AI call logs to `ai_usage`: model, task type, tokens in/out, estimated cost, timestamp. Powers cost-per-session dashboards and model comparison analytics.

## Data Model

**RLS convention:** All user-scoped tables include a `user_id` column (FK to `auth.users`) with an RLS policy restricting access to `auth.uid() = user_id`. Exceptions: `exercises` (system-seeded, see below), `muscle_groups` (read-only lookup with permissive SELECT policy).

**Weight unit:** kg only. No unit conversion in v1.

### Users & Profiles

- `users` — Supabase Auth. Profile extends with: display name, height, weight, date of birth, fitness goal (free text), experience level (beginner/intermediate/advanced).
- `user_gyms` — user's gym(s). Name, location, notes. Scoped by user, one user can have multiple.

### Equipment & Exercises

- `equipment` — machines/kit at a specific gym. Name, type (machine/free weight/cable/bodyweight/cardio), description, photo URL (optional). Scoped to gym via `gym_id`.
- `exercises` — the movement itself, gym-agnostic. Name, primary muscle group, secondary muscle groups, description, movement type (compound/isolation), equipment type needed. Seeded with standard library, users can add custom. Has nullable `user_id`: null = system seed (readable by all via permissive SELECT), non-null = user-created (RLS-scoped).
- `muscle_groups` — lookup table: chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core, forearms.

### Workout Plans

- `plans` — a training programme. Name, description, split type (push/pull/legs, upper/lower, full body, custom), created by (user or AI), active flag.
- `plan_days` — each day in the plan. Day label, target muscle groups, day order.
- `plan_day_exercises` — exercises prescribed for a plan day. Exercise, suggested sets/reps/weight (nullable), order, notes.

### Sessions

- `sessions` — a gym visit. User, timestamps (start/end), plan day reference (nullable), gym, pre-session energy (1-5, AI-inferred from conversation), pre-session mood (free text, nullable), notes.
- `session_sets` — individual sets. Session, exercise, set number, reps, weight (kg), RPE (1-10 Borg scale), duration (for timed exercises), notes. Atomic unit of training data.
- `session_cardio` — cardio entries. Session, exercise type, duration, distance (nullable), avg heart rate (nullable), notes.

### Subjective Tracking

- `body_check_ins` — daily entries. Date, soreness map (JSON keyed by muscle group, value 1-5), energy (1-5, AI-inferred), sleep quality (1-5, AI-inferred), general notes. Written by DOMS diagnostic conversation. Soreness map is deliberately JSON rather than a junction table — it's always read/written as a whole map, and queryability trade-off is acceptable for v1.
- `supplements` — user's inventory. Name, type (protein/creatine/vitamin/other), dosage unit, notes.
- `supplement_logs` — intake records. Supplement, timestamp, dosage (numeric, unit inherited from parent `supplements.dosage_unit`), notes.

### Classes

- `gym_classes` — parsed from screenshot. Gym, name, description, day of week, time, duration, instructor (nullable), muscle group tags, difficulty estimate.
- `class_attendances` — attendance records. Class, session link, notes, rating (1-5).

### Conversations

- `conversations` — chat threads. User, session reference (nullable), type (session/check-in/planning/question), timestamps.
- `conversation_messages` — messages. Conversation, role (user/assistant), content, timestamp, tool calls (JSON, nullable).

### System

- `model_config` — per-user model routing config. Typed JSON: `{ in_session: string, post_session: string, deep_analysis: string, fallback: string }`. Settings UI reads/writes this; schema is fixed to prevent it becoming a junk drawer.
- `ai_usage` — cost tracking. Model, task type, tokens in/out, estimated cost, timestamp.
- `pending_tasks` — Opus async queue. Task type, status (pending/processing/complete/failed), input/output JSON, timestamps, `retry_count` (default 0), `max_retries` (default 3), `claimed_at` (timestamp, for timeout detection). Mac job claims tasks via `UPDATE ... WHERE status = 'pending' AND claimed_at IS NULL RETURNING`. Failed tasks with exhausted retries surface in admin UI.

## API Layer

### Routes

```
POST /api/chat              — streaming conversation (AI SDK streamText)
GET  /api/sessions          — list sessions with summary stats
GET  /api/sessions/[id]     — session detail with all sets
GET  /api/progress          — progress data for charts
GET  /api/plans             — list plans
POST /api/plans/generate    — queue Opus plan generation task
GET  /api/check-ins         — body check-in history
GET  /api/settings          — model config, preferences
PUT  /api/settings          — update model config, preferences
POST /api/classes/ingest    — screenshot upload, vision model extracts class schedule
```

The chat route is the primary interface. Most user actions go through `/api/chat` — the AI decides which tools to call.

All routes verify Supabase JWT via middleware. Unauthenticated requests return 401.

### AI Tool Definitions

| Tool | Purpose | Target table |
|------|---------|-------------|
| `start_session` | Begin gym visit, set gym, link plan day | `sessions` |
| `log_set` | Record a set (exercise, reps, weight, RPE inferred) | `session_sets` |
| `log_cardio` | Record cardio (type, duration, distance, HR) | `session_cardio` |
| `end_session` | Close session, add notes | `sessions` |
| `record_check_in` | DOMS/energy/sleep assessment from diagnostic conversation | `body_check_ins` |
| `log_supplement` | Record supplement intake | `supplement_logs` |
| `get_todays_plan` | Fetch today's prescribed workout | reads `plans` chain |
| `get_exercise_history` | Recent history for an exercise (weight suggestions) | reads `session_sets` |
| `get_equipment` | List equipment at current gym | reads `equipment` |
| `add_equipment` | Add new equipment from user description | `equipment` |
| `get_classes` | List classes, filter by day/muscle group | reads `gym_classes` |
| `search_exercises` | Find exercises by muscle group/equipment/movement | reads `exercises` |

### Voice Input Flow

```
User speaks → Web Speech API (on-device, free) → text
  → POST /api/chat as message
  → AI SDK streamText with tools
  → model parses, calls tools
  → structured data → Supabase
  → response streamed back
  → optional TTS reads response
```

### Data Capture Layers

1. **During session (real-time)** — AI captures essentials per set: exercise, reps, weight, RPE (inferred). 3-4 fields. Ambiguous input stored in notes + conversation log.
2. **Post-session** — DOMS diagnostic, energy/mood, supplement log. AI asks probing questions, infers ratings.
3. **Background enrichment** — AI reviews conversations, fills gaps, resolves ambiguities ("that cable machine was probably the lat pulldown").

## PWA & Offline Strategy

**Works offline:**
- Viewing today's plan (cached on session start)
- Conversation UI (input buffered locally)
- Logging sets via tap-minimal fallback UI (IndexedDB queue)

**Requires connectivity:**
- AI responses
- History/progress queries
- Syncing to Supabase

**Offline queue:** Sets logged offline go into IndexedDB with timestamps. Service worker flushes queue to API when connectivity returns. UI shows "offline" indicator but doesn't block logging.

**Fallback UI:** When offline or in loud environments, a tap-minimal interface shows today's plan with big buttons. Tap to log a set, +/- to adjust weight/reps. No AI, just structured input.

## Class Integration

Screenshot of weekly timetable uploaded to `POST /api/classes/ingest`. Vision model (Sonnet/Flash) extracts: class name, day, time, duration, instructor. AI infers muscle group tags and difficulty. User reviews/corrects before saving.

Opus plan generation has access to class schedule and can incorporate classes into training splits.

## Phase Breakdown

### Phase 1 — Foundation

- Supabase schema + migrations
- Next.js app with PWA manifest
- `/api/chat` with AI SDK, tool calling, model router
- Core tools: start_session, log_set, log_cardio, end_session, get_todays_plan, get_exercise_history
- Seed data: exercise library, gym equipment, supplements
- Ingest existing session data as test data (raw notes from first gym visit, processed via one-off script)
- Basic conversation UI (text input first, voice second)
- Basic session review page
- Settings page (model selection)
- Cost tracking on all AI calls

### Phase 2 — Intelligence

- Body check-in / DOMS diagnostic conversation flow
- Class schedule screenshot ingestion
- Opus async queue + Mac launchd job for plan generation
- Progress charts (weight over time, volume trends)
- Supplement logging and timing
- Voice input via Web Speech API
- Tap-minimal fallback UI for offline/loud

### Phase 3 — Integration

- Jimbo API integration (calendar, nudges, context)
- Admin/tuning UI (model comparison, cost dashboards, experiment tracking)
- Multi-user support (auth flows, onboarding, gym setup wizard)
- Class recommendations based on training history + schedule

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data approach | Hybrid (structured + conversational) | Clean queryable data with conversation as insurance for unstructured context |
| Database | Supabase Pro | Auth, RLS, real-time, backups. Multi-user ready. Known tooling. |
| Framework | Next.js + AI SDK v6 | Conversational AI is the core UX. AI SDK purpose-built for this. |
| RPE scale | 1-10 Borg scale | Industry standard. AI infers from conversation, user doesn't pick numbers. |
| Voice | Web Speech API | Free, on-device, no API cost. LLM processes text only. |
| Offline | IndexedDB queue + tap fallback | Safety net, not primary experience. Most gyms have connectivity. |
| Model routing | Config-driven, tiered | Cheap models for real-time, Opus (free via Max) for heavy reasoning. Swappable via UI. |
| Styling | SCSS / CSS Modules | Per project conventions (CLAUDE.md). No Tailwind. |
| Weight unit | kg only | No unit conversion in v1. |
| Numeric subjective fields | AI-inferred, not user-facing | User describes feelings in conversation; AI maps to 1-5 or 1-10 scales internally. |

## Open Questions for Implementation

- Exact exercise seed data source — scrape a fitness API or curate manually?
- Supabase project name and region
- PWA icon and branding
- Whether to use `next-pwa` or manual service worker setup (depends on Next.js 16 compatibility)
