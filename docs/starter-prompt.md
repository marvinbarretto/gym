# Gym PWA — Continuation Prompt

Paste this into a fresh Claude Code session from `/Users/marvinbarretto/development/gym`.

---

## Prompt

I'm continuing work on my gym PWA. This is an AI-powered personal gym companion built with Next.js 16, AI SDK v6, and Supabase.

**What's done (Phase 1 — complete):**
- Full spec: `docs/superpowers/specs/2026-03-22-gym-pwa-design.md`
- Implementation plan: `docs/superpowers/plans/2026-03-22-gym-pwa-phase1.md`
- Next.js 16 scaffold with PWA manifest, SCSS/CSS Modules (no Tailwind)
- Supabase schema in `gym` schema (shared collectr project, ref: kgngznojdomyagmwwpwv)
- Generated TypeScript types from `supabase gen types --linked --schema gym`
- Config-driven model router supporting Anthropic direct, OpenRouter, and AI Gateway
- 9 AI tools (start_session, log_set, log_cardio, end_session, get_todays_plan, get_exercise_history, search_exercises, get_equipment, add_equipment)
- Streaming chat API route with verbose `[chat]` logging (steps, tool calls, tokens, cost)
- Chat UI with useChat v6 — markdown rendering (react-markdown), auto-growing textarea (Enter sends, Shift+Enter newline)
- Status bar on chat page showing active model badge + user email
- Dynamic system prompt that loads user context (default gym, session count, today's date)
- Retrospective session logging (start_session/end_session accept past timestamps)
- Session list and detail pages (Server Components)
- Bottom nav, settings page (model config editor + account/logout)
- Magic link auth via Supabase OTP
- Seed data: 32 equipment items, 5 supplements, model config
- First real session logged successfully (2026-03-22 Saturday gym visit)
- Deployed to Vercel: https://gym-kohl-theta.vercel.app

**Key files to read first:**
- `CLAUDE.md` — project conventions
- `docs/superpowers/specs/2026-03-22-gym-pwa-design.md` — full spec with Phase 2/3 roadmap
- `src/lib/ai/system-prompt.ts` — dynamic system prompt with user context loading
- `src/lib/ai/model-router.ts` — resolveModel() handles provider routing (note: Anthropic model IDs use hyphens not dots, e.g. `claude-haiku-4-5`)
- `src/lib/ai/tools.ts` — all 9 AI tool definitions
- `src/app/api/chat/route.ts` — streaming chat endpoint with verbose logging

**What I want to work on next:**

Priority UX improvements (from first real session):
1. **Quick-reply chips** — contextual suggestion buttons below the last AI message (e.g. "Next set", "Done with this exercise", "25kg x 10"). Reduces typing mid-workout. The AI or client suggests them based on session state.
2. **Live session tracker** — a collapsible panel showing what's been logged so far in the active session (exercises, sets, weights). Updates as tools fire. The structured view alongside the conversation.
3. **Post-session DOMS flow** — when end_session is called, transition to fatigue/soreness capture using the post_session model tier (Sonnet). Probing questions → writes to body_check_ins table.

Then Phase 2 from the spec:
- Voice input via Web Speech API
- Progress charts (weight over time, volume trends)
- Supplement logging and timing
- Class schedule screenshot ingestion
- Opus async queue for plan generation

**Design note:** This is a single-user app. The AI should make smart assumptions (auto-select the only gym, infer dates from "last Saturday", don't ask for info it can look up). Keep interactions minimal during active sessions — the user is sweating between sets.
