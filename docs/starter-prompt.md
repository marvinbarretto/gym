# Gym PWA — Continuation Prompt

Paste this into a fresh Claude Code session from `/Users/marvinbarretto/development/gym`.

---

## Prompt

I'm continuing work on my gym PWA — an AI-powered personal gym companion built with Next.js 16, AI SDK v6, and Supabase.

**What's done (Phase 1 foundation):**
- Full spec: `docs/superpowers/specs/2026-03-22-gym-pwa-design.md`
- Session redesign spec: `docs/superpowers/specs/2026-03-23-session-experience-redesign.md`
- Implementation plan: `docs/superpowers/plans/2026-03-23-session-experience-redesign.md`
- Working in worktree: `.worktrees/session-redesign` on branch `feature/session-redesign`

**Tasks completed (3 of 11):**
- Task 0: Schema migration (conversation constraints + indexes) ✅
- Task 1: Conversation DB functions (`src/lib/db/conversations.ts` + tests) ✅
- Task 2: Chat API persistence wiring (`src/app/api/chat/route.ts` modified, `src/app/api/conversations/route.ts` created) ✅

**Baseline test state:** 2 pre-existing failures in `model-router.test.ts` (unrelated), 8 passing + 4 new conversation tests passing.

**What I want to work on next:**

Continue executing the implementation plan using subagent-driven development, picking up from Task 3.

**Remaining tasks:**
- Task 3: Session lifecycle — start/resume/close (useSession hook, active session API, mode-aware chat page)
- Task 4: Mode-aware tool selection (free chat tools + record_check_in)
- Task 5: Toast notification system
- Task 6: Session tracker panel (stacked, collapsible, grouped exercises)
- Task 7: Wire tracker + toasts into ChatInterface
- Task 8: Inline set editing
- Task 9: Equipment-first system prompt + equipment audit
- Task 10: Vault integration (emit to Jimbo API)

**Out of scope:** Plan generation, supplements, voice input, progress charts, Opus async queue.

**Key conventions:**
- No Tailwind — SCSS/CSS Modules only
- No `vi.mock()` — builder functions for tests
- Conventional commits lowercase imperative
- The AI should be a quiet logger (not motivational), respond with precise gym terminology even when user speaks loosely
- Equipment names at the gym are canonical vocabulary

**First steps:**
1. Read the implementation plan: `docs/superpowers/plans/2026-03-23-session-experience-redesign.md`
2. Verify worktree state: `cd .worktrees/session-redesign && git log --oneline -5`
3. Invoke `superpowers:subagent-driven-development` skill
4. Resume from Task 3, dispatching one subagent per task with two-stage review
