# Session Experience Redesign — Design Spec

## Problem

The first real session (Saturday 21 March) revealed friction in every layer of the gym PWA:

- **11 round trips before any data was logged** — the AI treated retrospective logging like a medical intake, asking about each exercise one at a time
- **23-second tool call burst with no feedback** — 12 sets logged in one go, user saw "Thinking..." the entire time
- **Chat state is ephemeral** — a ReactMarkdown crash caused a full page reload and lost the conversation. No persistence means no resume, no history for the AI to learn from
- **Session lifecycle is implicit** — the AI decides when to create/end sessions. No clear boundary between "just chatting" and "logging a workout"
- **Exercise naming mismatch** — seeded exercise names ("Chest Press Machine", "Dumbbell Shoulder Press") don't match the equipment names at the user's gym ("Chest Press", "Shoulder Press"). Lateral raises were mislogged as shoulder press set 4
- **No edit capability** — if the AI logs something wrong, there's no way to fix it without going to the database
- **No confirmation of writes** — tool calls fire silently. No toast, no visual feedback

## Core Principles

1. **Equipment names are canonical** — the user thinks in terms of machine names at their gym. The AI accepts loose input but always responds with precise gym terminology, teaching vocabulary through osmosis.
2. **Quiet logger, not a personal trainer** — no motivation, no "great job!", no "ready for next set?". Confirm what was logged, ask only what's needed to fill data gaps.
3. **Two distinct modes** — free chat (no session) and session mode (active logging). Clear boundary, explicit transition.
4. **Store everything** — conversations, messages, tool calls. The raw transcript is the source of truth. Reprocessable by Opus later.
5. **Real-time feedback** — every tool call gets a toast. The session tracker updates live. The user always knows what's happening.

## Architecture

### Two Modes

#### Free Chat (default)

- No active session. Cheap model (Haiku).
- Available tools: `record_check_in`, `get_exercise_history`, `search_exercises`, `get_equipment`.
- No logging tools (`log_set`, `log_cardio`, `start_session`, `end_session`).
- Soreness mentioned casually gets captured via `record_check_in` tool, linked to the relevant past session via muscle groups and date proximity.
- AI uses precise gym vocabulary in responses. Accepts loose input.
- New conversation created each visit. System prompt includes summary of recent conversations for context continuity.

#### Session Mode

- Entered via explicit "Start Session" button in the UI.
- Creates a session record immediately (gym auto-selected since there's only one, timestamp set to now).
- Creates a linked conversation with `type: 'session'`.
- UI switches to stacked layout — collapsible tracker on top, chat below.
- Full tool set including `log_set`, `log_cardio`.
- In-session model (Haiku). AI is terse — confirms logs with precise terminology, asks only what's needed.
- Every tool call fires a toast notification.
- Exited via "End Session" button in tracker header, or saying "done" in chat.

#### Open Session on Return

When the app loads and detects a session with no `ended_at`:
- Show prompt: "You have an open session from [time]. Resume or close it?"
- **Resume** → enter session mode, load tracker state from DB, load conversation from persistence.
- **Close** → end session with current timestamp, drop to free chat.

### Conversation Persistence

#### Tables

Uses the tables already designed in the original spec:

- `conversations` — thread container.
  - `id` UUID PK
  - `user_id` FK to auth.users
  - `session_id` FK to sessions (nullable — null for free chat)
  - `type` enum: `session`, `check_in`, `planning`, `question`
  - `started_at`, `ended_at` timestamps

- `conversation_messages` — individual messages.
  - `id` UUID PK
  - `conversation_id` FK to conversations
  - `role` enum: `user`, `assistant`
  - `content` text
  - `tool_calls` JSONB (nullable) — stores the full tool call and result data
  - `created_at` timestamp

#### Behaviour

- Messages written to DB in real time via the `onFinish` / `onStepFinish` callbacks in the chat API route. Persistence failures are logged but never block the chat stream.
- On page load, `useChat` initialises with messages loaded from the active conversation.
- Tool calls stored as JSON in the message record — Opus can re-read exactly what happened.
- Session conversations are linked to their session via `session_id`.
- Free chat conversations get `type` classified by the AI or defaulted to `question`.

### Stacked Session Tracker

#### Layout

- **Tracker panel** above chat, collapsible.
- **Expanded state:**
  - Session header: date, elapsed time, "End Session" button.
  - Exercises grouped by name, displayed in log order.
  - Each group shows a mini table: Set | Reps | KG | RPE with edit icons.
- **Collapsed state:**
  - Summary bar: "3 exercises · 7 sets · 45min" with expand arrow.
- Auto-expands briefly when a new exercise group is added.

#### Inline Editing

- Tap ✎ on a row → fields become editable inputs (reps, kg, RPE).
- Tap exercise name → search/select to change exercise (for AI mismatch corrections).
- Save on blur or enter. Direct Supabase update — no round-trip through the AI.
- Delete a set via swipe or delete icon in edit mode.

#### Data Source

- Tracker reads from session's DB records, not from chat state.
- Polling via refetch after each AI response completes + on tool call toast. Start simple; upgrade to Supabase real-time subscription later if needed.
- This means tracker is always the source of truth, even if chat state is stale.

### Toast Notification System

- Lightweight toast component, bottom of screen, auto-dismiss after 3 seconds.
- Fires on every tool call: "Chest Press · Set 3 logged", "Session started", "Session ended".
- Colour-coded: green for success, amber for warnings (e.g. "No exercise match — logged as note").
- Toasts are per-tool-call for full visibility during the trust-building phase. Can be toned down later.

### Equipment-First AI Vocabulary

#### System Prompt Changes

- Load the user's gym equipment list into the system prompt alongside gym ID.
- Instructions:
  - "The user thinks in terms of equipment names at their gym. Match input to equipment names first."
  - "Always respond with the canonical equipment/exercise name. This teaches the user correct terminology through repetition, not correction."
  - "Accept loose descriptions gracefully. Don't ask for clarification unless genuinely ambiguous between two machines."

#### Equipment as Source of Truth

- The user's gym equipment names are canonical: Chest Press, Shoulder Press, Standing Leg Curl, Standing Calf Raise, Tricep Extension, Dual Adjustment Pulley, Lateral Seated Row.
- These are the starting set. More added via `add_equipment` tool or settings UI as the user encounters new machines.
- The seeded exercise table provides the taxonomy (muscle groups, movement types) but the equipment names are what the user sees in the tracker, toasts, and AI responses.
- When `search_exercises` returns empty, fall back to fuzzy matching against equipment list. If still no match, log with a note and flag — never silently mismap.

#### Progressive Vocabulary

- Early sessions: AI does heavy interpretation, responds with full names — "Logged: Overhead Tricep Extension · 20kg · 10 reps"
- As user adopts terminology: AI can become more terse — driven by conversation history showing the user using correct terms, not by code.

### Vault Integration

#### Events Emitted to Jimbo

- **Session summary** — on `end_session`: date, duration, exercises performed, total sets/volume, AI-generated one-line summary. Tags: `gym`, `session`, plus muscle groups worked.
- **Body check-ins** — when soreness/energy captured in free chat. Tags: `gym`, `doms`, `recovery`, plus affected muscle groups.
- **Milestones** — first session, new PR, streak. Tags: `gym`, `milestone`.

#### Implementation

- `emitToVault(item)` function in `src/lib/vault/` — typed payload, POST to Jimbo API.
- Fire-and-forget — don't block session flow if Jimbo is unavailable.
- Called from chat route `onFinish` (session end) and from `record_check_in` tool.
- Session summary generation uses Haiku (cheap enough for a one-liner).
- Vault payload shape to be aligned with Jimbo API later — gym side provides a clean interface.

#### Vault Event Types (Gym-Side Interface)

```typescript
interface VaultSessionSummary {
  type: 'gym_session'
  date: string          // ISO date
  duration_min: number
  exercises: string[]   // equipment names
  total_sets: number
  summary: string       // AI-generated one-liner
  tags: string[]        // ['gym', 'session', ...muscle_groups]
}

interface VaultCheckIn {
  type: 'gym_check_in'
  date: string
  soreness: Record<string, number>  // muscle_group → 1-5
  energy: number | null
  notes: string | null
  tags: string[]        // ['gym', 'doms', 'recovery', ...muscle_groups]
}

interface VaultMilestone {
  type: 'gym_milestone'
  date: string
  kind: 'first_session' | 'new_pr' | 'streak'
  description: string
  tags: string[]        // ['gym', 'milestone']
}
```

#### Not in Scope

- Jimbo reading gym data back (Jimbo-side feature).
- Real-time streaming during session (summary at end is sufficient).

## Data Model Changes

### New Tables

```sql
-- Conversation persistence
CREATE TABLE gym.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID REFERENCES gym.sessions(id),
  type TEXT NOT NULL CHECK (type IN ('session', 'check_in', 'planning', 'question')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE gym.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES gym.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies (same pattern as other tables)
ALTER TABLE gym.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_user ON gym.conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY conversation_messages_user ON gym.conversation_messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM gym.conversations WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_conversation_messages_conv ON gym.conversation_messages(conversation_id);
CREATE INDEX idx_conversations_session ON gym.conversations(session_id) WHERE session_id IS NOT NULL;
```

### Equipment Table Updates

- Audit and update equipment names to match actual gym machine labels.
- Replace generic seeded names with user's canonical names.

### Body Check-ins

Already in schema. Ensure the `body_check_ins` table supports linking to a past session (by date proximity / muscle group overlap, not direct FK — the check-in might reference multiple sessions).

## Sequencing (Implementation Order)

1. **Conversation persistence + session lifecycle** — migration, DB functions, chat API changes, open-session detection
2. **Session mode UI with stacked tracker + toasts** — Start/End Session buttons, stacked layout, grouped exercise display, toast component, real-time tracker updates
3. **Inline editing + equipment-first vocabulary** — edit-in-place in tracker, system prompt overhaul, equipment audit, fuzzy matching fallback
4. **Vault integration** — `emitToVault` interface, session summary generation, wiring to Jimbo API

## Future Work (Not in Scope)

- Plan generation and scheduling
- Supplement/conditioning management (creatine, vitamins, etc.)
- Voice input via Web Speech API
- Progress charts
- Opus async queue for deep analysis
