# Gym PWA — Continuation Prompt

Paste this into a fresh Claude Code session from `/Users/marvinbarretto/development/gym`.

---

## Prompt

I'm continuing work on my gym PWA. This is an AI-powered personal gym companion built with Next.js 16, AI SDK v6, and Supabase.

**What's done (Phase 1):**
- Full spec: `docs/superpowers/specs/2026-03-22-gym-pwa-design.md`
- Implementation plan: `docs/superpowers/plans/2026-03-22-gym-pwa-phase1.md`
- Next.js 16 scaffold with PWA manifest, SCSS/CSS Modules (no Tailwind)
- Supabase schema in `gym` schema (shared collectr project, ref: kgngznojdomyagmwwpwv)
- Generated TypeScript types from `supabase gen types --linked --schema gym`
- Config-driven model router supporting Anthropic direct, OpenRouter, and AI Gateway
- 9 AI tools (start_session, log_set, log_cardio, end_session, get_todays_plan, get_exercise_history, search_exercises, get_equipment, add_equipment)
- Streaming chat API route with cost tracking
- Chat UI with useChat v6 (no explicit transport — defaults to /api/chat)
- Session list and detail pages (Server Components)
- Bottom nav, settings page (model config editor)
- Magic link auth via Supabase OTP
- Seed data: 32 equipment items, 5 supplements, model config
- Deployed to Vercel: https://gym-kohl-theta.vercel.app

**Key files to read first:**
- `CLAUDE.md` — project conventions
- `docs/superpowers/specs/2026-03-22-gym-pwa-design.md` — full spec with Phase 2/3 roadmap
- `src/lib/ai/model-router.ts` — resolveModel() handles provider routing
- `src/lib/ai/tools.ts` — all 9 AI tool definitions
- `src/app/api/chat/route.ts` — streaming chat endpoint

**What I want to work on next:** [fill in — e.g. "Phase 2: voice input and DOMS diagnostics", "fix the chat UI", "add exercise seed data", "test a real gym session", etc.]
