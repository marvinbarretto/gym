# Gym PWA Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working AI gym companion that can hold a conversation, log workout sets via tool calling, and display session history — usable at the gym with text input.

**Architecture:** Next.js App Router with AI SDK v6 streaming chat. Supabase Pro for auth, database, and RLS. Config-driven model router selects the right LLM per task tier. All AI interactions log cost to `ai_usage`.

**Tech Stack:** Next.js 16, AI SDK v6, Supabase (Auth + Postgres + RLS), SCSS/CSS Modules, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-22-gym-pwa-design.md`

**Conventions (from CLAUDE.md):**
- No Tailwind — SCSS/CSS Modules only
- Vitest for unit tests, Playwright for E2E
- TypeScript types from database schema, not manual interfaces
- No `vi.mock()` — use builder functions
- Co-located test files (`*.test.ts` next to source)
- Conventional commits: `type: description` lowercase imperative ~70 chars
- RLS on all tables, `.limit()` on junction table queries
- Migrations: `YYYYMMDDHHMMSS_description.sql`

---

## File Structure

```
gym/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout, fonts, metadata
│   │   ├── layout.module.scss            # Root layout styles
│   │   ├── page.tsx                      # Landing / redirect to chat
│   │   ├── globals.scss                  # CSS reset, variables, tokens
│   │   ├── chat/
│   │   │   ├── page.tsx                  # Chat conversation UI
│   │   │   └── page.module.scss
│   │   ├── sessions/
│   │   │   ├── page.tsx                  # Session list
│   │   │   ├── page.module.scss
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx             # Session detail
│   │   │   │   └── page.module.scss
│   │   ├── settings/
│   │   │   ├── page.tsx                  # Model config + preferences
│   │   │   └── page.module.scss
│   │   └── api/
│   │       ├── chat/
│   │       │   └── route.ts             # Streaming chat endpoint
│   │       ├── sessions/
│   │       │   └── route.ts             # List sessions
│   │       ├── sessions/[id]/
│   │       │   └── route.ts             # Session detail
│   │       └── settings/
│   │           └── route.ts             # GET/PUT model config
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                # Browser Supabase client
│   │   │   ├── server.ts                # Server Supabase client
│   │   │   ├── middleware.ts            # Auth middleware helper
│   │   │   └── types.ts                 # Generated DB types (supabase gen types)
│   │   ├── ai/
│   │   │   ├── model-router.ts          # Config-driven model selection
│   │   │   ├── model-router.test.ts     # Model router tests
│   │   │   ├── tools.ts                 # AI SDK tool definitions
│   │   │   ├── tools.test.ts            # Tool definition tests
│   │   │   ├── system-prompt.ts         # Gym companion system prompt
│   │   │   └── cost-tracker.ts          # Log AI usage to Supabase
│   │   └── db/
│   │       ├── sessions.ts              # Session queries
│   │       ├── sessions.test.ts
│   │       ├── exercises.ts             # Exercise queries
│   │       ├── exercises.test.ts
│   │       ├── equipment.ts             # Equipment queries
│   │       └── equipment.test.ts
│   └── components/
│       ├── chat/
│       │   ├── chat-interface.tsx        # Chat container with message list + input
│       │   ├── chat-interface.module.scss
│       │   ├── message-bubble.tsx        # Single message display
│       │   ├── message-bubble.module.scss
│       │   ├── chat-input.tsx            # Text input with send button
│       │   └── chat-input.module.scss
│       ├── sessions/
│       │   ├── session-card.tsx          # Session summary card
│       │   ├── session-card.module.scss
│       │   ├── set-table.tsx             # Table of sets in a session
│       │   └── set-table.module.scss
│       └── layout/
│           ├── nav.tsx                   # Bottom nav (chat, sessions, settings)
│           └── nav.module.scss
├── supabase/
│   ├── config.toml                       # Supabase local dev config
│   └── migrations/
│       ├── 20260322120000_initial_schema.sql
│       ├── 20260322120001_rls_policies.sql
│       ├── 20260322120002_seed_muscle_groups.sql
│       └── 20260322120003_seed_exercises.sql
├── scripts/
│   └── seed-gym-data.ts                  # One-off: seed equipment + supplements
├── public/
│   ├── manifest.json                     # PWA manifest
│   └── icons/                            # PWA icons (placeholder)
├── next.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.local.example                    # Template for env vars
└── CLAUDE.md                             # Project-specific conventions
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.env.local.example`, `CLAUDE.md`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.scss`

- [ ] **Step 1: Initialise Next.js project**

```bash
cd /Users/marvinbarretto/development/gym
npx create-next-app@latest . --typescript --app --src-dir --no-tailwind --no-eslint --no-import-alias
```

Accept defaults. This creates the Next.js scaffold. The `--no-tailwind` flag ensures no Tailwind config.

- [ ] **Step 2: Install dependencies**

```bash
npm install ai @ai-sdk/react @ai-sdk/gateway @supabase/supabase-js @supabase/ssr sass
npm install -D vitest @vitejs/plugin-react supabase
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

- [ ] **Step 4: Create .env.local.example**

Create `.env.local.example`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Gateway — provisioned via `vercel env pull` (OIDC auth, no manual API keys)
# VERCEL_OIDC_TOKEN is auto-provisioned on Vercel deployments
# For local dev, run: vercel link && vercel env pull
```

- [ ] **Step 5: Create project CLAUDE.md**

Create `CLAUDE.md`:

```markdown
# CLAUDE.md — Gym PWA

## What This Is

AI-powered personal gym companion PWA. Voice-first workout logging, conversational DOMS diagnosis, config-driven model routing.

## Stack

Next.js 16 (App Router), AI SDK v6, Supabase Pro, SCSS/CSS Modules.

## Conventions

- No Tailwind — SCSS/CSS Modules only
- Vitest for unit tests, Playwright for E2E
- TypeScript types from `supabase gen types` — never manual interfaces for DB types
- No `vi.mock()` — use builder functions
- Co-located test files (`*.test.ts` next to source)
- Conventional commits: `type: description` lowercase imperative
- RLS on all Supabase tables, `.limit()` on junction table queries
- Migrations: `YYYYMMDDHHMMSS_description.sql` in `supabase/migrations/`
- Weight unit: kg only

## Key Paths

- `src/lib/ai/` — model router, tool definitions, system prompt, cost tracker
- `src/lib/supabase/` — client, server, middleware, generated types
- `src/lib/db/` — query functions (thin wrappers around Supabase client)
- `supabase/migrations/` — SQL migrations
- `scripts/` — one-off seed/ingestion scripts

## Spec

`docs/superpowers/specs/2026-03-22-gym-pwa-design.md`
```

- [ ] **Step 6: Rename default CSS to SCSS, clean up scaffold**

Rename `src/app/globals.css` → `src/app/globals.scss`. Delete any Tailwind references in the default scaffold. Update `layout.tsx` import to `./globals.scss`. Remove default Next.js boilerplate content from `page.tsx`.

- [ ] **Step 7: Add PWA manifest**

Create `public/manifest.json`:

```json
{
  "name": "Gym",
  "short_name": "Gym",
  "start_url": "/chat",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Add to `layout.tsx` head:
```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0a0a0a" />
```

Create placeholder icons (simple colored squares are fine for now).

- [ ] **Step 8: Verify scaffold runs**

```bash
npm run dev
```

Visit `http://localhost:3000`. Confirm it renders without errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with PWA manifest"
```

---

## Task 2: Supabase Schema — Core Tables

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20260322120000_initial_schema.sql`
- Create: `supabase/migrations/20260322120001_rls_policies.sql`

- [ ] **Step 1: Initialise Supabase locally**

```bash
cd /Users/marvinbarretto/development/gym
npx supabase init
```

This creates `supabase/config.toml`.

- [ ] **Step 2: Create a new Supabase project**

Go to Supabase dashboard, create project "gym" in the London region. Copy the project URL, anon key, and service role key into `.env.local`.

- [ ] **Step 3: Link local Supabase to remote**

```bash
npx supabase link --project-ref <project-ref>
```

- [ ] **Step 4: Write initial schema migration**

Create `supabase/migrations/20260322120000_initial_schema.sql`:

```sql
-- Muscle groups lookup
create table muscle_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- User profiles (extends Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  height_cm numeric,
  weight_kg numeric,
  date_of_birth date,
  fitness_goal text,
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced')) default 'beginner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User gyms
create table user_gyms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- Equipment at a gym
create table equipment (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references user_gyms(id) on delete cascade,
  name text not null,
  type text not null check (type in ('machine', 'free_weight', 'cable', 'bodyweight', 'cardio')),
  description text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- Exercises (system-seeded + user-created)
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = system seed
  name text not null,
  primary_muscle_group_id uuid references muscle_groups(id),
  secondary_muscle_group_ids uuid[] default '{}',
  description text,
  movement_type text check (movement_type in ('compound', 'isolation')),
  equipment_type text check (equipment_type in ('machine', 'free_weight', 'cable', 'bodyweight', 'cardio')),
  created_at timestamptz not null default now()
);

-- Workout plans
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  split_type text check (split_type in ('push_pull_legs', 'upper_lower', 'full_body', 'custom')),
  created_by text not null check (created_by in ('user', 'ai')) default 'ai',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Plan days
create table plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  label text not null,
  target_muscle_group_ids uuid[] default '{}',
  day_order integer not null,
  created_at timestamptz not null default now()
);

-- Plan day exercises
create table plan_day_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references plan_days(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  suggested_sets integer,
  suggested_reps integer,
  suggested_weight_kg numeric,
  exercise_order integer not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Workout sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid references user_gyms(id),
  plan_day_id uuid references plan_days(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  pre_energy integer check (pre_energy between 1 and 5),
  pre_mood text,
  notes text,
  created_at timestamptz not null default now()
);

-- Session sets (atomic unit)
create table session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  set_number integer not null,
  reps integer,
  weight_kg numeric,
  rpe integer check (rpe between 1 and 10),
  duration_seconds integer, -- for timed exercises
  notes text,
  created_at timestamptz not null default now()
);

-- Session cardio
create table session_cardio (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  exercise_type text not null,
  duration_seconds integer not null,
  distance_km numeric,
  avg_heart_rate integer,
  notes text,
  created_at timestamptz not null default now()
);

-- Body check-ins
create table body_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_in_date date not null default current_date,
  soreness_map jsonb not null default '{}',
  energy integer check (energy between 1 and 5),
  sleep_quality integer check (sleep_quality between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

-- Supplements
create table supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('protein', 'creatine', 'vitamin', 'other')),
  dosage_unit text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Supplement logs
create table supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplement_id uuid not null references supplements(id) on delete cascade,
  taken_at timestamptz not null default now(),
  dosage numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Gym classes
create table gym_classes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references user_gyms(id) on delete cascade,
  name text not null,
  description text,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Mon
  start_time time not null,
  duration_minutes integer not null,
  instructor text,
  muscle_group_tags uuid[] default '{}',
  difficulty_estimate integer check (difficulty_estimate between 1 and 5),
  created_at timestamptz not null default now()
);

-- Class attendances
create table class_attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references gym_classes(id) on delete cascade,
  session_id uuid references sessions(id),
  attended_at timestamptz not null default now(),
  notes text,
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

-- Conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references sessions(id),
  type text not null check (type in ('session', 'check_in', 'planning', 'question')) default 'session',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- Conversation messages
create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

-- Model config (per-user)
create table model_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  config jsonb not null default '{"in_session": "anthropic/claude-haiku-4.5", "post_session": "anthropic/claude-sonnet-4.6", "deep_analysis": "opus-local", "fallback": "google/gemini-2.5-flash"}',
  updated_at timestamptz not null default now()
);

-- AI usage / cost tracking
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  task_type text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Pending tasks (Opus async queue)
create table pending_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_type text not null,
  status text not null check (status in ('pending', 'processing', 'complete', 'failed')) default 'pending',
  input_data jsonb not null default '{}',
  output_data jsonb,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes
create index idx_sessions_user_id on sessions(user_id);
create index idx_sessions_started_at on sessions(started_at desc);
create index idx_session_sets_session_id on session_sets(session_id);
create index idx_session_sets_exercise_id on session_sets(exercise_id);
create index idx_exercises_user_id on exercises(user_id);
create index idx_exercises_primary_muscle on exercises(primary_muscle_group_id);
create index idx_conversations_user_id on conversations(user_id);
create index idx_conversation_messages_conversation_id on conversation_messages(conversation_id);
create index idx_ai_usage_user_id on ai_usage(user_id);
create index idx_ai_usage_created_at on ai_usage(created_at desc);
create index idx_pending_tasks_status on pending_tasks(status) where status = 'pending';
```

- [ ] **Step 5: Write RLS policies migration**

Create `supabase/migrations/20260322120001_rls_policies.sql`:

```sql
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table user_gyms enable row level security;
alter table equipment enable row level security;
alter table exercises enable row level security;
alter table plans enable row level security;
alter table plan_days enable row level security;
alter table plan_day_exercises enable row level security;
alter table sessions enable row level security;
alter table session_sets enable row level security;
alter table session_cardio enable row level security;
alter table body_check_ins enable row level security;
alter table supplements enable row level security;
alter table supplement_logs enable row level security;
alter table gym_classes enable row level security;
alter table class_attendances enable row level security;
alter table conversations enable row level security;
alter table conversation_messages enable row level security;
alter table model_config enable row level security;
alter table ai_usage enable row level security;
alter table pending_tasks enable row level security;
alter table muscle_groups enable row level security;

-- Muscle groups: read-only for all authenticated users
create policy "muscle_groups_select" on muscle_groups for select to authenticated using (true);

-- Profiles: users can CRUD their own
create policy "profiles_select" on profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert" on profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update" on profiles for update to authenticated using (id = auth.uid());

-- User gyms: scoped by user_id
create policy "user_gyms_select" on user_gyms for select to authenticated using (user_id = auth.uid());
create policy "user_gyms_insert" on user_gyms for insert to authenticated with check (user_id = auth.uid());
create policy "user_gyms_update" on user_gyms for update to authenticated using (user_id = auth.uid());
create policy "user_gyms_delete" on user_gyms for delete to authenticated using (user_id = auth.uid());

-- Equipment: accessible if user owns the gym
create policy "equipment_select" on equipment for select to authenticated
  using (gym_id in (select id from user_gyms where user_id = auth.uid()));
create policy "equipment_insert" on equipment for insert to authenticated
  with check (gym_id in (select id from user_gyms where user_id = auth.uid()));
create policy "equipment_update" on equipment for update to authenticated
  using (gym_id in (select id from user_gyms where user_id = auth.uid()));
create policy "equipment_delete" on equipment for delete to authenticated
  using (gym_id in (select id from user_gyms where user_id = auth.uid()));

-- Exercises: system seeds readable by all, user-created scoped
create policy "exercises_select" on exercises for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy "exercises_insert" on exercises for insert to authenticated
  with check (user_id = auth.uid());
create policy "exercises_update" on exercises for update to authenticated
  using (user_id = auth.uid());
create policy "exercises_delete" on exercises for delete to authenticated
  using (user_id = auth.uid());

-- Standard user_id scoped policies (macro pattern)
-- Plans
create policy "plans_select" on plans for select to authenticated using (user_id = auth.uid());
create policy "plans_insert" on plans for insert to authenticated with check (user_id = auth.uid());
create policy "plans_update" on plans for update to authenticated using (user_id = auth.uid());
create policy "plans_delete" on plans for delete to authenticated using (user_id = auth.uid());

-- Plan days: accessible if user owns the plan
create policy "plan_days_select" on plan_days for select to authenticated
  using (plan_id in (select id from plans where user_id = auth.uid()));
create policy "plan_days_insert" on plan_days for insert to authenticated
  with check (plan_id in (select id from plans where user_id = auth.uid()));
create policy "plan_days_update" on plan_days for update to authenticated
  using (plan_id in (select id from plans where user_id = auth.uid()));
create policy "plan_days_delete" on plan_days for delete to authenticated
  using (plan_id in (select id from plans where user_id = auth.uid()));

-- Plan day exercises: accessible if user owns the plan day's plan
create policy "plan_day_exercises_select" on plan_day_exercises for select to authenticated
  using (plan_day_id in (select pd.id from plan_days pd join plans p on pd.plan_id = p.id where p.user_id = auth.uid()));
create policy "plan_day_exercises_insert" on plan_day_exercises for insert to authenticated
  with check (plan_day_id in (select pd.id from plan_days pd join plans p on pd.plan_id = p.id where p.user_id = auth.uid()));
create policy "plan_day_exercises_update" on plan_day_exercises for update to authenticated
  using (plan_day_id in (select pd.id from plan_days pd join plans p on pd.plan_id = p.id where p.user_id = auth.uid()));
create policy "plan_day_exercises_delete" on plan_day_exercises for delete to authenticated
  with check (plan_day_id in (select pd.id from plan_days pd join plans p on pd.plan_id = p.id where p.user_id = auth.uid()));

-- Sessions
create policy "sessions_select" on sessions for select to authenticated using (user_id = auth.uid());
create policy "sessions_insert" on sessions for insert to authenticated with check (user_id = auth.uid());
create policy "sessions_update" on sessions for update to authenticated using (user_id = auth.uid());

-- Session sets: accessible if user owns the session
create policy "session_sets_select" on session_sets for select to authenticated
  using (session_id in (select id from sessions where user_id = auth.uid()));
create policy "session_sets_insert" on session_sets for insert to authenticated
  with check (session_id in (select id from sessions where user_id = auth.uid()));
create policy "session_sets_update" on session_sets for update to authenticated
  using (session_id in (select id from sessions where user_id = auth.uid()));

-- Session cardio: accessible if user owns the session
create policy "session_cardio_select" on session_cardio for select to authenticated
  using (session_id in (select id from sessions where user_id = auth.uid()));
create policy "session_cardio_insert" on session_cardio for insert to authenticated
  with check (session_id in (select id from sessions where user_id = auth.uid()));

-- Body check-ins
create policy "body_check_ins_select" on body_check_ins for select to authenticated using (user_id = auth.uid());
create policy "body_check_ins_insert" on body_check_ins for insert to authenticated with check (user_id = auth.uid());
create policy "body_check_ins_update" on body_check_ins for update to authenticated using (user_id = auth.uid());

-- Supplements
create policy "supplements_select" on supplements for select to authenticated using (user_id = auth.uid());
create policy "supplements_insert" on supplements for insert to authenticated with check (user_id = auth.uid());
create policy "supplements_update" on supplements for update to authenticated using (user_id = auth.uid());
create policy "supplements_delete" on supplements for delete to authenticated using (user_id = auth.uid());

-- Supplement logs
create policy "supplement_logs_select" on supplement_logs for select to authenticated using (user_id = auth.uid());
create policy "supplement_logs_insert" on supplement_logs for insert to authenticated with check (user_id = auth.uid());

-- Gym classes: accessible if user owns the gym
create policy "gym_classes_select" on gym_classes for select to authenticated
  using (gym_id in (select id from user_gyms where user_id = auth.uid()));
create policy "gym_classes_insert" on gym_classes for insert to authenticated
  with check (gym_id in (select id from user_gyms where user_id = auth.uid()));
create policy "gym_classes_update" on gym_classes for update to authenticated
  using (gym_id in (select id from user_gyms where user_id = auth.uid()));
create policy "gym_classes_delete" on gym_classes for delete to authenticated
  using (gym_id in (select id from user_gyms where user_id = auth.uid()));

-- Class attendances
create policy "class_attendances_select" on class_attendances for select to authenticated using (user_id = auth.uid());
create policy "class_attendances_insert" on class_attendances for insert to authenticated with check (user_id = auth.uid());

-- Conversations
create policy "conversations_select" on conversations for select to authenticated using (user_id = auth.uid());
create policy "conversations_insert" on conversations for insert to authenticated with check (user_id = auth.uid());
create policy "conversations_update" on conversations for update to authenticated using (user_id = auth.uid());

-- Conversation messages: accessible if user owns the conversation
create policy "conversation_messages_select" on conversation_messages for select to authenticated
  using (conversation_id in (select id from conversations where user_id = auth.uid()));
create policy "conversation_messages_insert" on conversation_messages for insert to authenticated
  with check (conversation_id in (select id from conversations where user_id = auth.uid()));

-- Model config
create policy "model_config_select" on model_config for select to authenticated using (user_id = auth.uid());
create policy "model_config_insert" on model_config for insert to authenticated with check (user_id = auth.uid());
create policy "model_config_update" on model_config for update to authenticated using (user_id = auth.uid());

-- AI usage
create policy "ai_usage_select" on ai_usage for select to authenticated using (user_id = auth.uid());
create policy "ai_usage_insert" on ai_usage for insert to authenticated with check (user_id = auth.uid());

-- Pending tasks
create policy "pending_tasks_select" on pending_tasks for select to authenticated using (user_id = auth.uid());
create policy "pending_tasks_insert" on pending_tasks for insert to authenticated with check (user_id = auth.uid());
create policy "pending_tasks_update" on pending_tasks for update to authenticated using (user_id = auth.uid());
```

- [ ] **Step 6: Write seed data migrations**

Create `supabase/migrations/20260322120002_seed_muscle_groups.sql`:

```sql
insert into muscle_groups (name) values
  ('chest'), ('back'), ('shoulders'), ('biceps'), ('triceps'),
  ('quads'), ('hamstrings'), ('glutes'), ('calves'), ('core'), ('forearms');
```

Create `supabase/migrations/20260322120003_seed_exercises.sql`:

```sql
-- Seed ~30 common beginner-friendly exercises
-- user_id is null = system seed
insert into exercises (name, primary_muscle_group_id, movement_type, equipment_type, description)
select name, mg.id, movement_type, equipment_type, description
from (values
  ('Bench Press', 'chest', 'compound', 'free_weight', 'Lie on bench, press barbell up from chest'),
  ('Chest Press Machine', 'chest', 'compound', 'machine', 'Seated machine press targeting chest'),
  ('Dumbbell Fly', 'chest', 'isolation', 'free_weight', 'Lie on bench, arc dumbbells out and together'),
  ('Lat Pulldown', 'back', 'compound', 'cable', 'Pull wide bar down to chest from overhead'),
  ('Seated Row', 'back', 'compound', 'cable', 'Pull handle towards torso while seated'),
  ('Bent Over Row', 'back', 'compound', 'free_weight', 'Hinge at hips, pull barbell to lower chest'),
  ('Overhead Press', 'shoulders', 'compound', 'free_weight', 'Press barbell or dumbbells overhead from shoulders'),
  ('Lateral Raise', 'shoulders', 'isolation', 'free_weight', 'Raise dumbbells out to sides to shoulder height'),
  ('Face Pull', 'shoulders', 'isolation', 'cable', 'Pull rope attachment towards face at head height'),
  ('Bicep Curl', 'biceps', 'isolation', 'free_weight', 'Curl dumbbells or barbell from arms extended to shoulders'),
  ('Hammer Curl', 'biceps', 'isolation', 'free_weight', 'Curl dumbbells with neutral grip'),
  ('Cable Curl', 'biceps', 'isolation', 'cable', 'Curl cable attachment from low pulley'),
  ('Tricep Pushdown', 'triceps', 'isolation', 'cable', 'Push cable bar or rope down from chest height'),
  ('Tricep Dip', 'triceps', 'compound', 'bodyweight', 'Lower and press body up on parallel bars'),
  ('Overhead Tricep Extension', 'triceps', 'isolation', 'free_weight', 'Extend dumbbell overhead from behind head'),
  ('Squat', 'quads', 'compound', 'free_weight', 'Barbell on back, squat down and stand up'),
  ('Leg Press', 'quads', 'compound', 'machine', 'Push weighted platform away with feet'),
  ('Leg Extension', 'quads', 'isolation', 'machine', 'Extend legs against padded bar while seated'),
  ('Romanian Deadlift', 'hamstrings', 'compound', 'free_weight', 'Hinge at hips with barbell, slight knee bend'),
  ('Leg Curl', 'hamstrings', 'isolation', 'machine', 'Curl legs against padded bar while lying or seated'),
  ('Hip Thrust', 'glutes', 'compound', 'free_weight', 'Drive hips up with barbell across lap, back on bench'),
  ('Cable Kickback', 'glutes', 'isolation', 'cable', 'Kick leg back against cable resistance'),
  ('Calf Raise', 'calves', 'isolation', 'machine', 'Rise up on toes against resistance'),
  ('Plank', 'core', 'isolation', 'bodyweight', 'Hold body rigid in push-up position on forearms'),
  ('Cable Crunch', 'core', 'isolation', 'cable', 'Kneel and crunch against cable resistance'),
  ('Dead Hang', 'forearms', 'isolation', 'bodyweight', 'Hang from bar with straight arms'),
  ('Treadmill', 'quads', 'compound', 'cardio', 'Walking or running on motorised belt'),
  ('Stationary Bike', 'quads', 'compound', 'cardio', 'Cycling on fixed bike'),
  ('Rowing Machine', 'back', 'compound', 'cardio', 'Full-body rowing motion on ergometer'),
  ('Elliptical', 'quads', 'compound', 'cardio', 'Low-impact striding motion')
) as seed(name, muscle_group_name, movement_type, equipment_type, description)
join muscle_groups mg on mg.name = seed.muscle_group_name;
```

- [ ] **Step 7: Run migrations against remote Supabase**

```bash
npx supabase db push
```

Verify tables exist in Supabase dashboard.

- [ ] **Step 8: Generate TypeScript types**

```bash
npx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/types.ts
```

- [ ] **Step 9: Commit**

```bash
git add supabase/ src/lib/supabase/types.ts
git commit -m "feat: add Supabase schema, RLS policies, and seed data"
```

---

## Task 3: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Modify: `src/app/layout.tsx` (add auth provider if needed)

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create auth middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return supabaseResponse
}
```

- [ ] **Step 4: Create proxy.ts for auth session refresh**

Create `src/proxy.ts` (Next.js 16 — replaces middleware.ts):

```typescript
import { updateSession } from '@/lib/supabase/middleware'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json).*)',
  ],
}
```

- [ ] **Step 5: Verify build still works**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/ src/proxy.ts
git commit -m "feat: add Supabase client, server, and auth middleware"
```

---

## Task 4: Model Router

**Files:**
- Create: `src/lib/ai/model-router.ts`
- Create: `src/lib/ai/model-router.test.ts`
- Create: `src/lib/ai/cost-tracker.ts`

- [ ] **Step 1: Write failing test for model router**

Create `src/lib/ai/model-router.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getModelId, type ModelConfig, DEFAULT_MODEL_CONFIG } from './model-router'

describe('model-router', () => {
  it('returns in_session model for session task type', () => {
    expect(getModelId('in_session', DEFAULT_MODEL_CONFIG)).toBe('anthropic/claude-haiku-4.5')
  })

  it('returns post_session model for check_in task type', () => {
    expect(getModelId('post_session', DEFAULT_MODEL_CONFIG)).toBe('anthropic/claude-sonnet-4.6')
  })

  it('returns fallback model for unknown tier', () => {
    expect(getModelId('unknown' as any, DEFAULT_MODEL_CONFIG)).toBe('google/gemini-2.5-flash')
  })

  it('accepts custom config', () => {
    const custom: ModelConfig = {
      in_session: 'custom/model-a',
      post_session: 'custom/model-b',
      deep_analysis: 'opus-local',
      fallback: 'custom/model-c',
    }
    expect(getModelId('in_session', custom)).toBe('custom/model-a')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/ai/model-router.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement model router**

Create `src/lib/ai/model-router.ts`:

```typescript
export interface ModelConfig {
  in_session: string
  post_session: string
  deep_analysis: string
  fallback: string
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  in_session: 'anthropic/claude-haiku-4.5',
  post_session: 'anthropic/claude-sonnet-4.6',
  deep_analysis: 'opus-local',
  fallback: 'google/gemini-2.5-flash',
}

export type ModelTier = keyof ModelConfig

export function getModelId(tier: ModelTier, config: ModelConfig): string {
  return config[tier] ?? config.fallback
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/ai/model-router.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Implement cost tracker**

Create `src/lib/ai/cost-tracker.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface UsageRecord {
  userId: string
  model: string
  taskType: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

// Approximate costs per 1M tokens — update as prices change
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'anthropic/claude-haiku-4.5': { input: 0.25, output: 1.25 },
  'anthropic/claude-sonnet-4.6': { input: 3, output: 15 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MILLION[model] ?? { input: 1, output: 3 } // conservative default
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000
}

export async function logUsage(
  supabase: SupabaseClient<Database>,
  record: UsageRecord
): Promise<void> {
  await supabase.from('ai_usage').insert({
    user_id: record.userId,
    model: record.model,
    task_type: record.taskType,
    input_tokens: record.inputTokens,
    output_tokens: record.outputTokens,
    estimated_cost_usd: record.estimatedCostUsd,
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/
git commit -m "feat: add config-driven model router and cost tracker"
```

---

## Task 5: AI Tool Definitions

**Files:**
- Create: `src/lib/ai/tools.ts`
- Create: `src/lib/ai/tools.test.ts`
- Create: `src/lib/ai/system-prompt.ts`
- Create: `src/lib/db/sessions.ts`
- Create: `src/lib/db/exercises.ts`
- Create: `src/lib/db/equipment.ts`

- [ ] **Step 1: Create database query helpers**

Create `src/lib/db/sessions.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database>

export async function createSession(supabase: Supabase, data: {
  userId: string
  gymId?: string
  planDayId?: string
  preEnergy?: number
  preMood?: string
}) {
  return supabase.from('sessions').insert({
    user_id: data.userId,
    gym_id: data.gymId ?? null,
    plan_day_id: data.planDayId ?? null,
    pre_energy: data.preEnergy ?? null,
    pre_mood: data.preMood ?? null,
  }).select().single()
}

export async function endSession(supabase: Supabase, sessionId: string, notes?: string) {
  return supabase.from('sessions').update({
    ended_at: new Date().toISOString(),
    notes: notes ?? null,
  }).eq('id', sessionId).select().single()
}

export async function logSet(supabase: Supabase, data: {
  sessionId: string
  exerciseId: string
  setNumber: number
  reps?: number
  weightKg?: number
  rpe?: number
  durationSeconds?: number
  notes?: string
}) {
  return supabase.from('session_sets').insert({
    session_id: data.sessionId,
    exercise_id: data.exerciseId,
    set_number: data.setNumber,
    reps: data.reps ?? null,
    weight_kg: data.weightKg ?? null,
    rpe: data.rpe ?? null,
    duration_seconds: data.durationSeconds ?? null,
    notes: data.notes ?? null,
  }).select().single()
}

export async function logCardio(supabase: Supabase, data: {
  sessionId: string
  exerciseType: string
  durationSeconds: number
  distanceKm?: number
  avgHeartRate?: number
  notes?: string
}) {
  return supabase.from('session_cardio').insert({
    session_id: data.sessionId,
    exercise_type: data.exerciseType,
    duration_seconds: data.durationSeconds,
    distance_km: data.distanceKm ?? null,
    avg_heart_rate: data.avgHeartRate ?? null,
    notes: data.notes ?? null,
  }).select().single()
}

export async function getRecentSessions(supabase: Supabase, userId: string, limit = 10) {
  return supabase.from('sessions')
    .select('*, session_sets(*, exercises(name)), session_cardio(*)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)
}

export async function getSessionDetail(supabase: Supabase, sessionId: string) {
  return supabase.from('sessions')
    .select('*, session_sets(*, exercises(name, primary_muscle_group_id)), session_cardio(*), user_gyms(name)')
    .eq('id', sessionId)
    .single()
}
```

Create `src/lib/db/exercises.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database>

export async function searchExercises(supabase: Supabase, filters: {
  muscleGroupId?: string
  equipmentType?: string
  movementType?: string
  query?: string
}) {
  let q = supabase.from('exercises').select('*, muscle_groups!exercises_primary_muscle_group_id_fkey(name)')

  if (filters.muscleGroupId) {
    q = q.eq('primary_muscle_group_id', filters.muscleGroupId)
  }
  if (filters.equipmentType) {
    q = q.eq('equipment_type', filters.equipmentType)
  }
  if (filters.movementType) {
    q = q.eq('movement_type', filters.movementType)
  }
  if (filters.query) {
    q = q.ilike('name', `%${filters.query}%`)
  }

  return q.order('name').limit(20)
}

export async function getExerciseHistory(supabase: Supabase, exerciseId: string, limit = 20) {
  return supabase.from('session_sets')
    .select('*, sessions(started_at)')
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false })
    .limit(limit)
}
```

Create `src/lib/db/equipment.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database>

export async function getEquipment(supabase: Supabase, gymId: string) {
  return supabase.from('equipment')
    .select('*')
    .eq('gym_id', gymId)
    .order('name')
    .limit(100)
}

export async function addEquipment(supabase: Supabase, data: {
  gymId: string
  name: string
  type: 'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio'
  description?: string
}) {
  return supabase.from('equipment').insert({
    gym_id: data.gymId,
    name: data.name,
    type: data.type,
    description: data.description ?? null,
  }).select().single()
}
```

- [ ] **Step 2: Create system prompt**

Create `src/lib/ai/system-prompt.ts`:

```typescript
export const GYM_COMPANION_SYSTEM_PROMPT = `You are a knowledgeable, encouraging gym companion AI. The user is a beginner who recently joined a gym for the first time.

Your role:
- Lead them through workout sessions, telling them what to do next
- Log their exercises, sets, reps, and weights using the tools provided
- Infer RPE (Rate of Perceived Exertion, 1-10 Borg scale) from their descriptions — never ask them for a number directly. Instead ask how it felt ("was that easy?", "were the last few reps a struggle?", "could you have done more?") and map to RPE yourself.
- Explain exercises simply — what muscles they work, basic form cues
- Be concise during sessions — they're between sets, not reading essays
- When they mention soreness or pain, ask diagnostic follow-up questions like a physiotherapist would

Conversation style:
- Short, direct messages during active sessions (1-2 sentences)
- More detailed when explaining something new or answering questions
- Use encouraging but not patronising language
- If they describe something you can't map to an exercise, store what they said in notes and ask clarifying questions

Data capture priorities during a session:
1. Which exercise (match to known exercises or add to notes)
2. Reps completed
3. Weight used (kg)
4. How it felt (→ infer RPE)
5. Any pain or discomfort (→ flag for DOMS tracking)

Weight is always in kg. Never suggest exercises that require equipment the user's gym doesn't have.

When starting a session, check if there's an active plan and suggest today's workout. If there's no plan, ask what they'd like to work on and guide them through appropriate exercises.`
}
```

- [ ] **Step 3: Create AI tool definitions**

Create `src/lib/ai/tools.ts`:

```typescript
import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { createSession, endSession, logSet, logCardio } from '@/lib/db/sessions'
import { searchExercises, getExerciseHistory } from '@/lib/db/exercises'
import { getEquipment, addEquipment } from '@/lib/db/equipment'

type Supabase = SupabaseClient<Database>

export function createGymTools(supabase: Supabase, userId: string) {
  return {
    start_session: tool({
      description: 'Start a new gym session. Call this when the user arrives at the gym or wants to begin a workout.',
      inputSchema: z.object({
        gym_id: z.string().uuid().optional().describe('The gym where the session is taking place'),
        plan_day_id: z.string().uuid().optional().describe('The plan day to follow, if any'),
        pre_energy: z.number().min(1).max(5).optional().describe('Pre-session energy level, inferred from conversation'),
        pre_mood: z.string().optional().describe('Pre-session mood description'),
      }),
      execute: async (input) => {
        const { data, error } = await createSession(supabase, { userId, ...input })
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
        rpe: z.number().int().min(1).max(10).optional().describe('Rate of Perceived Exertion (1-10), inferred from user description'),
        duration_seconds: z.number().int().optional().describe('Duration for timed exercises like planks'),
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
          durationSeconds: input.duration_seconds,
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
        exercise_type: z.string().describe('Type of cardio (treadmill, bike, rowing, elliptical)'),
        duration_seconds: z.number().int().min(0).describe('How long in seconds'),
        distance_km: z.number().min(0).optional().describe('Distance covered in km'),
        avg_heart_rate: z.number().int().optional().describe('Average heart rate'),
        notes: z.string().optional(),
      }),
      execute: async (input) => {
        const { data, error } = await logCardio(supabase, {
          sessionId: input.session_id,
          exerciseType: input.exercise_type,
          durationSeconds: input.duration_seconds,
          distanceKm: input.distance_km,
          avgHeartRate: input.avg_heart_rate,
          notes: input.notes,
        })
        if (error) return { error: error.message }
        return { cardioId: data.id, message: 'Cardio logged' }
      },
    }),

    end_session: tool({
      description: 'End the current gym session.',
      inputSchema: z.object({
        session_id: z.string().uuid().describe('Session to end'),
        notes: z.string().optional().describe('Overall session notes'),
      }),
      execute: async (input) => {
        const { data, error } = await endSession(supabase, input.session_id, input.notes)
        if (error) return { error: error.message }
        return { message: 'Session ended', endedAt: data.ended_at }
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
        muscle_group_id: z.string().uuid().optional(),
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
      description: 'Add a new piece of equipment to the gym. Use when the user describes a machine that is not in the equipment list.',
      inputSchema: z.object({
        gym_id: z.string().uuid(),
        name: z.string().describe('Equipment name'),
        type: z.enum(['machine', 'free_weight', 'cable', 'bodyweight', 'cardio']),
        description: z.string().optional().describe('What it looks like or does'),
      }),
      execute: async (input) => {
        const { data, error } = await addEquipment(supabase, input)
        if (error) return { error: error.message }
        return { equipmentId: data.id, message: `Added ${input.name}` }
      },
    }),
  }
}
```

- [ ] **Step 4: Write tool schema test**

Create `src/lib/ai/tools.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createGymTools } from './tools'

// Verify tool definitions are valid (schema + execute exist)
describe('gym tools', () => {
  // Minimal stub — we're testing schema shape, not Supabase calls
  const stubSupabase = {} as any
  const tools = createGymTools(stubSupabase, 'test-user-id')

  it('defines all required tools', () => {
    const expectedTools = [
      'start_session', 'log_set', 'log_cardio', 'end_session',
      'get_exercise_history', 'search_exercises', 'get_equipment', 'add_equipment',
    ]
    const toolNames = Object.keys(tools)
    for (const name of expectedTools) {
      expect(toolNames).toContain(name)
    }
  })

  it('each tool has description and execute', () => {
    for (const [name, t] of Object.entries(tools)) {
      expect(t, `${name} missing description`).toHaveProperty('description')
      expect(t, `${name} missing execute`).toHaveProperty('execute')
    }
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/lib/ai/
```

Expected: PASS (all model-router + tools tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/ src/lib/db/
git commit -m "feat: add AI tool definitions, db queries, and system prompt"
```

---

## Task 6: Chat API Route

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Create the streaming chat endpoint**

Create `src/app/api/chat/route.ts`:

```typescript
import { streamText, type UIMessage } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createGymTools } from '@/lib/ai/tools'
import { getModelId, DEFAULT_MODEL_CONFIG, type ModelConfig } from '@/lib/ai/model-router'
import { estimateCost, logUsage } from '@/lib/ai/cost-tracker'
import { GYM_COMPANION_SYSTEM_PROMPT } from '@/lib/ai/system-prompt'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages }: { messages: UIMessage[] } = await request.json()

  // Load user's model config (or use defaults)
  const { data: configRow } = await supabase
    .from('model_config')
    .select('config')
    .eq('user_id', user.id)
    .single()

  const modelConfig: ModelConfig = configRow?.config as ModelConfig ?? DEFAULT_MODEL_CONFIG
  const modelId = getModelId('in_session', modelConfig)
  const model = getModel(modelId)

  const tools = createGymTools(supabase, user.id)

  const result = streamText({
    model,
    system: GYM_COMPANION_SYSTEM_PROMPT,
    messages,
    tools,
    maxSteps: 5,
    onFinish: async ({ usage }) => {
      if (usage) {
        await logUsage(supabase, {
          userId: user.id,
          model: modelId,
          taskType: 'in_session',
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          estimatedCostUsd: estimateCost(modelId, usage.promptTokens, usage.completionTokens),
        })
      }
    },
  })

  return result.toDataStreamResponse()
}
```

Note: This uses `maxSteps` and `toDataStreamResponse()` — these may need updating to AI SDK v6 equivalents (`stopWhen: stepCountIs(5)` and `toUIMessageStreamResponse()`) depending on the exact API at implementation time. Check the AI SDK docs at `https://sdk.vercel.ai/docs` before implementing.

- [ ] **Step 2: Verify the route compiles**

```bash
npm run build
```

Fix any type errors. The route won't be functionally testable until we have auth wired up, but it should compile.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/
git commit -m "feat: add streaming chat API route with tool calling"
```

---

## Task 7: Chat UI

**Files:**
- Create: `src/components/chat/chat-interface.tsx`, `chat-interface.module.scss`
- Create: `src/components/chat/message-bubble.tsx`, `message-bubble.module.scss`
- Create: `src/components/chat/chat-input.tsx`, `chat-input.module.scss`
- Create: `src/app/chat/page.tsx`, `src/app/chat/page.module.scss`

- [ ] **Step 1: Create message bubble component**

Create `src/components/chat/message-bubble.tsx`:

```tsx
import styles from './message-bubble.module.scss'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div className={`${styles.bubble} ${styles[role]}`}>
      <p>{content}</p>
    </div>
  )
}
```

Create `src/components/chat/message-bubble.module.scss`:

```scss
.bubble {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  margin-bottom: 0.5rem;
  line-height: 1.4;

  p {
    margin: 0;
  }
}

.user {
  background: var(--color-accent, #2563eb);
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 0.25rem;
}

.assistant {
  background: var(--color-surface, #1e1e1e);
  color: var(--color-text, #e5e5e5);
  align-self: flex-start;
  border-bottom-left-radius: 0.25rem;
}
```

- [ ] **Step 2: Create chat input component**

Create `src/components/chat/chat-input.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import styles from './chat-input.module.scss'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setInput('')
  }

  return (
    <form className={styles.inputBar} onSubmit={handleSubmit}>
      <input
        type="text"
        className={styles.textInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Tell me what you did..."
        disabled={isLoading}
        autoFocus
      />
      <button
        type="submit"
        className={styles.sendButton}
        disabled={!input.trim() || isLoading}
      >
        Send
      </button>
    </form>
  )
}
```

Create `src/components/chat/chat-input.module.scss`:

```scss
.inputBar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid var(--color-border, #333);
  background: var(--color-bg, #0a0a0a);
  position: sticky;
  bottom: 0;
}

.textInput {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 1.5rem;
  border: 1px solid var(--color-border, #333);
  background: var(--color-surface, #1e1e1e);
  color: var(--color-text, #e5e5e5);
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: var(--color-accent, #2563eb);
  }

  &::placeholder {
    color: var(--color-muted, #666);
  }
}

.sendButton {
  padding: 0.75rem 1.25rem;
  border-radius: 1.5rem;
  border: none;
  background: var(--color-accent, #2563eb);
  color: white;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

- [ ] **Step 3: Create chat interface container**

Create `src/components/chat/chat-interface.tsx`:

```tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import styles from './chat-interface.module.scss'
import { useEffect, useRef } from 'react'

export function ChatInterface() {
  const { messages, status, sendMessage } = useChat({
    api: '/api/chat',
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.container}>
      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <p>Ready when you are. Tell me about your workout.</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.parts?.filter(p => p.type === 'text').map(p => p.text).join('') ?? ''}
          />
        ))}
        {isLoading && (
          <div className={styles.typing}>Thinking...</div>
        )}
      </div>
      <ChatInput onSend={(text) => sendMessage({ text })} isLoading={isLoading} />
    </div>
  )
}
```

Note: `useChat` API may differ in AI SDK v6 — check docs at `https://sdk.vercel.ai/docs` for exact hook signature. The `sendMessage({ text })` pattern and `message.parts` iteration are v6 conventions.

Create `src/components/chat/chat-interface.module.scss`:

```scss
.container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 600px;
  margin: 0 auto;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-muted, #666);
  text-align: center;
}

.typing {
  color: var(--color-muted, #666);
  font-style: italic;
  padding: 0.5rem 0;
}
```

- [ ] **Step 4: Create the chat page**

Create `src/app/chat/page.tsx`:

```tsx
import { ChatInterface } from '@/components/chat/chat-interface'

export default function ChatPage() {
  return <ChatInterface />
}
```

Create `src/app/chat/page.module.scss`:

```scss
// Intentionally empty — all styles in chat-interface.module.scss
```

- [ ] **Step 5: Verify it renders**

```bash
npm run dev
```

Visit `http://localhost:3000/chat`. The chat UI should render (it won't send messages without auth yet, but should display without errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/ src/app/chat/
git commit -m "feat: add chat UI with message bubbles and input"
```

---

## Task 8: Session List & Detail Pages

**Files:**
- Create: `src/app/sessions/page.tsx`, `page.module.scss`
- Create: `src/app/sessions/[id]/page.tsx`, `page.module.scss`
- Create: `src/components/sessions/session-card.tsx`, `session-card.module.scss`
- Create: `src/components/sessions/set-table.tsx`, `set-table.module.scss`
- Create: `src/app/api/sessions/route.ts`
- Create: `src/app/api/sessions/[id]/route.ts`

- [ ] **Step 1: Create session API routes**

Create `src/app/api/sessions/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getRecentSessions } from '@/lib/db/sessions'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await getRecentSessions(supabase, user.id, 20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

Create `src/app/api/sessions/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionDetail } from '@/lib/db/sessions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await getSessionDetail(supabase, id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Create session card component**

Create `src/components/sessions/session-card.tsx`:

```tsx
import Link from 'next/link'
import styles from './session-card.module.scss'

interface SessionCardProps {
  id: string
  startedAt: string
  endedAt: string | null
  gymName?: string
  setCount: number
  exerciseNames: string[]
}

export function SessionCard({ id, startedAt, endedAt, gymName, setCount, exerciseNames }: SessionCardProps) {
  const date = new Date(startedAt)
  const duration = endedAt
    ? Math.round((new Date(endedAt).getTime() - date.getTime()) / 60000)
    : null

  return (
    <Link href={`/sessions/${id}`} className={styles.card}>
      <div className={styles.date}>
        {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
      <div className={styles.details}>
        {gymName && <span className={styles.gym}>{gymName}</span>}
        <span className={styles.stats}>
          {setCount} sets{duration ? ` \u00b7 ${duration} min` : ''}
        </span>
        <span className={styles.exercises}>
          {exerciseNames.slice(0, 3).join(', ')}{exerciseNames.length > 3 ? '...' : ''}
        </span>
      </div>
    </Link>
  )
}
```

Create `src/components/sessions/session-card.module.scss`:

```scss
.card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--color-border, #333);
  border-radius: 0.75rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--color-accent, #2563eb);
  }
}

.date {
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-muted, #999);
}

.details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.gym {
  font-weight: 600;
}

.stats {
  font-size: 0.875rem;
  color: var(--color-muted, #999);
}

.exercises {
  font-size: 0.875rem;
  color: var(--color-muted, #666);
}
```

- [ ] **Step 3: Create set table component**

Create `src/components/sessions/set-table.tsx`:

```tsx
import styles from './set-table.module.scss'

interface SetRow {
  exerciseName: string
  setNumber: number
  reps: number | null
  weightKg: number | null
  rpe: number | null
  notes: string | null
}

interface SetTableProps {
  sets: SetRow[]
}

export function SetTable({ sets }: SetTableProps) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Exercise</th>
          <th>Set</th>
          <th>Reps</th>
          <th>kg</th>
          <th>RPE</th>
        </tr>
      </thead>
      <tbody>
        {sets.map((set, i) => (
          <tr key={i}>
            <td>{set.exerciseName}</td>
            <td>{set.setNumber}</td>
            <td>{set.reps ?? '-'}</td>
            <td>{set.weightKg ?? '-'}</td>
            <td>{set.rpe ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

Create `src/components/sessions/set-table.module.scss`:

```scss
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;

  th, td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #333);
  }

  th {
    font-weight: 600;
    color: var(--color-muted, #999);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  td:nth-child(n+2) {
    text-align: center;
  }

  th:nth-child(n+2) {
    text-align: center;
  }
}
```

- [ ] **Step 4: Create session list page (Server Component)**

Create `src/app/sessions/page.tsx`:

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getRecentSessions } from '@/lib/db/sessions'
import { SessionCard } from '@/components/sessions/session-card'
import { redirect } from 'next/navigation'
import styles from './page.module.scss'

export default async function SessionsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: sessions } = await getRecentSessions(supabase, user.id, 20)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Sessions</h1>
      <div className={styles.list}>
        {sessions && sessions.length > 0 ? (
          sessions.map((session: any) => {
            const exerciseNames = [...new Set(
              (session.session_sets || []).map((s: any) => s.exercises?.name).filter(Boolean)
            )] as string[]
            return (
              <SessionCard
                key={session.id}
                id={session.id}
                startedAt={session.started_at}
                endedAt={session.ended_at}
                setCount={(session.session_sets || []).length}
                exerciseNames={exerciseNames}
              />
            )
          })
        ) : (
          <p className={styles.empty}>No sessions yet. Start one from the chat.</p>
        )}
      </div>
    </div>
  )
}
```

Create `src/app/sessions/page.module.scss`:

```scss
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty {
  color: var(--color-muted, #666);
  text-align: center;
  padding: 3rem 1rem;
}
```

- [ ] **Step 5: Create session detail page (Server Component)**

Create `src/app/sessions/[id]/page.tsx`:

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionDetail } from '@/lib/db/sessions'
import { SetTable } from '@/components/sessions/set-table'
import { redirect } from 'next/navigation'
import styles from './page.module.scss'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: session, error } = await getSessionDetail(supabase, id)

  if (error || !session) redirect('/sessions')

  const sets = (session.session_sets || []).map((s: any) => ({
    exerciseName: s.exercises?.name ?? 'Unknown',
    setNumber: s.set_number,
    reps: s.reps,
    weightKg: s.weight_kg,
    rpe: s.rpe,
    notes: s.notes,
  }))

  const date = new Date(session.started_at)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h1>
      {(session as any).user_gyms?.name && (
        <p className={styles.gym}>{(session as any).user_gyms.name}</p>
      )}
      {session.notes && <p className={styles.notes}>{session.notes}</p>}
      <SetTable sets={sets} />
    </div>
  )
}
```

Create `src/app/sessions/[id]/page.module.scss`:

```scss
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.gym {
  color: var(--color-muted, #999);
  margin-bottom: 1rem;
}

.notes {
  font-style: italic;
  color: var(--color-muted, #999);
  margin-bottom: 1rem;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/sessions/ src/app/api/sessions/ src/components/sessions/
git commit -m "feat: add session list and detail pages with API routes"
```

---

## Task 9: Navigation & Settings

**Files:**
- Create: `src/components/layout/nav.tsx`, `nav.module.scss`
- Create: `src/app/settings/page.tsx`, `page.module.scss`
- Create: `src/app/api/settings/route.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create bottom nav**

Create `src/components/layout/nav.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './nav.module.scss'

const navItems = [
  { href: '/chat', label: 'Chat' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/settings', label: 'Settings' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.item} ${pathname.startsWith(item.href) ? styles.active : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
```

Create `src/components/layout/nav.module.scss`:

```scss
.nav {
  display: flex;
  justify-content: space-around;
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border, #333);
  background: var(--color-bg, #0a0a0a);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.item {
  text-decoration: none;
  color: var(--color-muted, #666);
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.25rem 1rem;

  &.active {
    color: var(--color-accent, #2563eb);
  }
}
```

- [ ] **Step 2: Create settings API route**

Create `src/app/api/settings/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DEFAULT_MODEL_CONFIG } from '@/lib/ai/model-router'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase.from('model_config').select('config').eq('user_id', user.id).single()
  return NextResponse.json(data?.config ?? DEFAULT_MODEL_CONFIG)
}

export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const config = await request.json()
  const { error } = await supabase.from('model_config').upsert({
    user_id: user.id,
    config,
    updated_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create settings page**

Create `src/app/settings/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import styles from './page.module.scss'

interface ModelConfig {
  in_session: string
  post_session: string
  deep_analysis: string
  fallback: string
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setConfig)
  }, [])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
  }

  if (!config) return <div className={styles.container}>Loading...</div>

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Settings</h1>
      <div className={styles.section}>
        <h2>Model Routing</h2>
        {(Object.keys(config) as Array<keyof ModelConfig>).map((key) => (
          <label key={key} className={styles.field}>
            <span className={styles.label}>{key.replace(/_/g, ' ')}</span>
            <input
              type="text"
              className={styles.input}
              value={config[key]}
              onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
            />
          </label>
        ))}
        <button className={styles.saveButton} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
```

Create `src/app/settings/page.module.scss`:

```scss
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem;
  padding-bottom: 5rem; // space for nav
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.section {
  h2 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-muted, #999);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.label {
  font-size: 0.875rem;
  color: var(--color-muted, #999);
  text-transform: capitalize;
}

.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border, #333);
  border-radius: 0.5rem;
  background: var(--color-surface, #1e1e1e);
  color: var(--color-text, #e5e5e5);
  font-family: monospace;
  font-size: 0.875rem;
}

.saveButton {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--color-accent, #2563eb);
  color: white;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;

  &:disabled {
    opacity: 0.5;
  }
}
```

- [ ] **Step 4: Add nav to root layout**

Modify `src/app/layout.tsx` to include the Nav component:

```tsx
import { Nav } from '@/components/layout/nav'
import './globals.scss'

export const metadata = {
  title: 'Gym',
  description: 'AI-powered gym companion',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body>
        <main style={{ paddingBottom: '4rem' }}>{children}</main>
        <Nav />
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Update globals.scss with design tokens**

Update `src/app/globals.scss`:

```scss
:root {
  --color-bg: #0a0a0a;
  --color-surface: #1e1e1e;
  --color-border: #333;
  --color-text: #e5e5e5;
  --color-muted: #999;
  --color-accent: #2563eb;

  color-scheme: dark;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
}
```

- [ ] **Step 6: Redirect root to chat**

Update `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/chat')
}
```

- [ ] **Step 7: Verify full app renders**

```bash
npm run dev
```

Navigate between /chat, /sessions, /settings. All pages should render with the bottom nav.

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: add navigation, settings page, and global styles"
```

---

## Task 10: Seed Personal Data Script

**Files:**
- Create: `scripts/seed-gym-data.ts`

- [ ] **Step 1: Create seed script**

Create `scripts/seed-gym-data.ts`:

```typescript
/**
 * One-off script to seed personal gym data.
 * Run with: npx tsx scripts/seed-gym-data.ts
 *
 * Prerequisites:
 * - Supabase project set up with schema migrated
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * - A user account created in Supabase Auth
 *
 * This seeds:
 * - Your gym (name, location)
 * - Equipment at your gym
 * - Supplements you have
 *
 * Modify the data below to match your actual gym.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role bypasses RLS for seeding
)

// TODO: Replace with your actual Supabase Auth user ID
const USER_ID = 'YOUR_USER_ID_HERE'

// TODO: Replace with your gym details
const GYM = {
  name: 'My Gym',
  location: 'Watford',
  notes: 'Joined March 2026',
}

// TODO: Replace with equipment at your gym
const EQUIPMENT = [
  { name: 'Chest Press Machine', type: 'machine' as const, description: 'Seated chest press' },
  { name: 'Lat Pulldown', type: 'cable' as const, description: 'Cable lat pulldown station' },
  { name: 'Leg Press', type: 'machine' as const, description: 'Angled leg press' },
  { name: 'Cable Station', type: 'cable' as const, description: 'Dual adjustable cables' },
  { name: 'Smith Machine', type: 'machine' as const, description: 'Guided barbell on rails' },
  { name: 'Dumbbells', type: 'free_weight' as const, description: '2-40kg range' },
  { name: 'Treadmill', type: 'cardio' as const },
  { name: 'Stationary Bike', type: 'cardio' as const },
  { name: 'Rowing Machine', type: 'cardio' as const },
]

// TODO: Replace with supplements you have
const SUPPLEMENTS = [
  { name: 'Whey Protein', type: 'protein' as const, dosage_unit: 'scoop (30g)' },
  { name: 'Creatine Monohydrate', type: 'creatine' as const, dosage_unit: 'g' },
]

async function seed() {
  console.log('Seeding gym data...')

  // Create gym
  const { data: gym, error: gymError } = await supabase
    .from('user_gyms')
    .insert({ user_id: USER_ID, ...GYM })
    .select()
    .single()

  if (gymError) { console.error('Gym error:', gymError); return }
  console.log(`Created gym: ${gym.name} (${gym.id})`)

  // Create equipment
  for (const eq of EQUIPMENT) {
    const { error } = await supabase.from('equipment').insert({ gym_id: gym.id, ...eq })
    if (error) console.error(`Equipment error (${eq.name}):`, error)
    else console.log(`  Added: ${eq.name}`)
  }

  // Create supplements
  for (const sup of SUPPLEMENTS) {
    const { error } = await supabase.from('supplements').insert({ user_id: USER_ID, ...sup })
    if (error) console.error(`Supplement error (${sup.name}):`, error)
    else console.log(`  Added: ${sup.name}`)
  }

  // Create default model config
  const { error: configError } = await supabase.from('model_config').insert({
    user_id: USER_ID,
    config: {
      in_session: 'anthropic/claude-haiku-4.5',
      post_session: 'anthropic/claude-sonnet-4.6',
      deep_analysis: 'opus-local',
      fallback: 'google/gemini-2.5-flash',
    },
  })
  if (configError) console.error('Config error:', configError)
  else console.log('  Created default model config')

  console.log('\nDone! Update the TODO values and re-run if needed.')
}

seed()
```

- [ ] **Step 2: Commit**

```bash
git add scripts/
git commit -m "feat: add personal gym data seed script"
```

---

## Task 11: Auth Flow (Basic)

**Files:**
- Create: `src/app/login/page.tsx`, `page.module.scss`
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Enable email auth in Supabase dashboard**

Go to Supabase Dashboard → Authentication → Providers. Enable Email provider (it's on by default). For Phase 1 we'll use magic links — no password needed.

- [ ] **Step 2: Create login page**

Create `src/app/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.scss'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (!error) setSent(true)
  }

  if (sent) {
    return (
      <div className={styles.container}>
        <p>Check your email for the login link.</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Gym</h1>
      <form onSubmit={handleLogin} className={styles.form}>
        <input
          type="email"
          className={styles.input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className={styles.button}>Sign in</button>
      </form>
    </div>
  )
}
```

Create `src/app/login/page.module.scss`:

```scss
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 2rem;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 2rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 320px;
}

.input {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border, #333);
  border-radius: 0.5rem;
  background: var(--color-surface, #1e1e1e);
  color: var(--color-text, #e5e5e5);
  font-size: 1rem;
}

.button {
  padding: 0.75rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--color-accent, #2563eb);
  color: white;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}
```

- [ ] **Step 3: Create auth callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/chat`)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/login/ src/app/auth/
git commit -m "feat: add magic link auth flow"
```

---

## Task 12: End-to-End Smoke Test

**Files:**
- No new files — this is a verification task

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Sign in**

Navigate to `/login`, enter your email, click the magic link.

- [ ] **Step 3: Run the seed script**

Update `scripts/seed-gym-data.ts` with your actual user ID (from Supabase dashboard → Authentication → Users) and gym details. Run:

```bash
npx tsx scripts/seed-gym-data.ts
```

- [ ] **Step 4: Test the chat**

Go to `/chat`. Type "I'm at the gym, let's start a session". Verify the AI responds and calls the `start_session` tool. Type "I just did 12 reps on the chest press at 30kg, felt pretty easy". Verify `log_set` is called.

- [ ] **Step 5: Check sessions page**

Go to `/sessions`. Verify the session you just created appears. Click into it and verify the sets are displayed.

- [ ] **Step 6: Test settings**

Go to `/settings`. Verify model config loads. Change a model, save, refresh — verify it persisted.

- [ ] **Step 7: Check cost tracking**

In Supabase dashboard, check the `ai_usage` table. Verify entries were created for the chat interactions.

- [ ] **Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix: address smoke test findings"
```

---

## Task 13: Deploy to Vercel

**Files:**
- No new files

- [ ] **Step 1: Create Vercel project**

```bash
cd /Users/marvinbarretto/development/gym
npx vercel link
```

Follow prompts to create a new Vercel project.

- [ ] **Step 2: Set environment variables**

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
```

Then enable AI Gateway in the Vercel dashboard and pull OIDC credentials:

```bash
vercel env pull
```

- [ ] **Step 3: Deploy preview**

```bash
npx vercel
```

Verify the preview URL works on your phone — add to home screen, test PWA behaviour.

- [ ] **Step 4: Deploy production**

```bash
npx vercel --prod
```

- [ ] **Step 5: Commit any deploy-related fixes**

```bash
git add -A
git commit -m "chore: vercel deployment config"
```
