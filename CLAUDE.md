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
