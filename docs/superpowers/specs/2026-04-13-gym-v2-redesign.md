# Gym V2 Redesign

## Goal

Rebuild the gym session logging flow from scratch at `/v2`. The AI is a parser — it turns natural language into structured workout data. The app handles all state and DB writes. Current app stays at `/chat` untouched until v2 is proven.

## What's Wrong With V1

- AI calls tools to write to DB — unreliable, fragile, race-prone
- Session ID managed via React memos and props — goes stale between sessions
- Cardio entries never displayed in tracker
- Exercise UUID resolution done by the AI (should be server-side)
- Conversation persistence on every message (unnecessary, often fails)
- No tests on core loop
- State scattered across 5+ hooks with no single source of truth

## Design Principles

- **AI is a parser, not an actor.** It receives natural language and returns structured JSON. It never writes to the DB.
- **The app owns state.** One Zustand store is the source of truth for session, exercises, and UI state.
- **Server resolves names.** AI returns exercise names ("chest press"), server fuzzy-matches to UUIDs.
- **Save immediately, allow edits.** No confirmation dialogs. Show an undo/edit option after saving.
- **Only workout data hits the DB.** No conversation persistence.
- **Test the core loop.** Parser → resolver → DB write → tracker update.

## Architecture

```
User types: "3 sets of 10 on chest press at 40kg"
    ↓
Chat input sends message to AI
    ↓
AI returns structured JSON:
  { exercise: "chest press", sets: [{ reps: 10, weight_kg: 40 }, ...] }
    ↓
Server endpoint receives parsed data:
  1. Fuzzy-match "chest press" → "Chest Press Machine" (UUID: abc-123)
  2. Insert rows into session_sets
  3. Return saved data with IDs
    ↓
Zustand store updates with new sets
    ↓
Tracker re-renders from store
    ↓
Toast: "Chest Press Machine — 3×10 @ 40kg" with edit/undo
```

## Zustand Store

Single store with these slices:

```typescript
interface GymStore {
  // Session
  session: Session | null
  startSession: () => Promise<void>
  endSession: () => Promise<void>
  resumeSession: (session: Session) => void

  // Exercise log (source of truth for tracker)
  sets: SessionSet[]
  cardio: SessionCardio[]
  addSets: (sets: SessionSet[]) => void
  addCardio: (entry: SessionCardio) => void
  removeSets: (ids: string[]) => void  // undo
  removeCardio: (id: string) => void   // undo
  loadSessionData: (sessionId: string) => Promise<void>

  // UI
  activeModel: string | null
  setActiveModel: (model: string) => void
}
```

No `conversationId` in the store — chat messages live only in `useChat` local state. When the session changes, `useChat` resets (via React key).

## AI Parser

The AI's job is to extract structured data from natural language. It doesn't call tools. It doesn't know about UUIDs or session IDs.

**System prompt** (simplified):

```
You are a gym session parser. The user will describe exercises they did.
Extract structured data and return JSON.

Known exercises at this gym:
- Chest Press Machine
- Treadmill Run
- Lat Pulldown
... (loaded from DB at session start)

Return JSON in this format:
{
  "type": "log_sets",
  "exercise": "Chest Press Machine",  // canonical name from list above
  "sets": [
    { "reps": 10, "weight_kg": 40 },
    { "reps": 10, "weight_kg": 40 },
    { "reps": 10, "weight_kg": 40 }
  ]
}

Or for cardio:
{
  "type": "log_cardio",
  "exercise": "Treadmill Run",
  "duration_min": 30,
  "distance_km": 5
}

Or for conversation (questions, how it felt, etc):
{
  "type": "chat",
  "message": "RPE 3-4 based on your description. Nice easy session."
}

If you can't match the exercise name, return:
{
  "type": "clarify",
  "message": "Which machine did you use — chest press or pec deck?"
}

Rules:
- Always use canonical exercise names from the list above
- Weight is always kg
- Infer RPE from how the user describes the effort — never ask for a number
- Keep responses to 1-2 sentences max
- If the user describes multiple exercises, return an array of objects
```

**Key difference from v1:** The AI returns JSON in its text response. No tool calling. The client parses the JSON and sends it to a separate API endpoint for saving.

## API Endpoints (new, under /api/v2/)

### POST /api/v2/parse
Receives the raw AI response, extracts JSON blocks, resolves exercise names to UUIDs, saves to DB.

```typescript
// Request
{ sessionId: string, parsed: ParsedEntry[] }

// ParsedEntry
{ type: "log_sets", exercise: string, sets: SetData[] }
| { type: "log_cardio", exercise: string, duration_min: number, distance_km?: number }

// Response
{ saved: SavedEntry[], errors: string[] }
```

This endpoint:
1. Fuzzy-matches exercise names against the exercise table
2. Inserts rows into `session_sets` or `session_cardio`
3. Returns the saved data (with UUIDs and DB IDs) so the store can update

### POST /api/v2/chat
Thin wrapper around AI SDK `streamText`. Sends the user's message + system prompt (with exercise list). Returns streamed text. No tool calling, no conversation persistence.

### Existing endpoints
`/api/sessions/active` (GET, POST, PATCH) — keep as-is, they work fine.
`/api/sessions/[id]` (GET) — keep as-is for loading session detail.

## Exercise Name Resolution

Server-side fuzzy matching. When the AI returns "chest press", the server:

1. Exact match against `exercises.name` (case-insensitive)
2. If no exact match, fuzzy search (Postgres `ILIKE '%chest%press%'` or similar)
3. If still ambiguous (multiple matches), return an error so the AI can ask for clarification
4. If no match at all, return an error

This is a simple function, easy to test, no AI involvement.

## Chat Interface (v2)

`/v2` page with:

- **Zustand-connected tracker** at top (reads from store, not from API fetch)
- **Chat messages** in the middle (local `useChat` state only)
- **Input** at bottom
- **Toast with undo** after each save

When the AI responds:
1. Display the text part as a chat bubble
2. Extract any JSON blocks from the response
3. Send JSON to `POST /api/v2/parse`
4. Update Zustand store with saved data
5. Show toast with undo option

When session changes:
1. Store resets sets/cardio
2. Chat component remounts (React key = session ID)
3. Store loads existing data for new session

## Model Routing (simplified)

- Primary: Anthropic direct (from user's model_config in DB)
- Fallback: OpenRouter free models
- No preflight check — just try primary, catch error, try fallback
- Fallback happens at the `/api/v2/chat` level, not a separate utility

## What's NOT Changing

- Supabase schema (all tables stay)
- Auth flow (magic link / Google)
- Settings page
- Sessions list page
- WorkManager / background sync concepts
- Vault integration (stays in session end flow)

## Testing Plan

Unit tests for:
- Exercise name resolver (exact match, fuzzy match, no match, ambiguous)
- AI response JSON extractor (valid JSON, no JSON, malformed JSON, multiple entries)
- Zustand store actions (addSets, removeSets, loadSessionData)
- Parse endpoint (happy path, missing exercise, invalid session)

Integration test:
- Start session → send message → AI responds → data parsed → store updates → tracker shows entry

## File Plan

| File | Action |
|------|--------|
| `src/app/v2/page.tsx` | New — v2 entry point |
| `src/app/v2/page.module.scss` | New |
| `src/app/api/v2/chat/route.ts` | New — streaming AI, no tools |
| `src/app/api/v2/parse/route.ts` | New — save parsed workout data |
| `src/lib/store/gym-store.ts` | New — Zustand store |
| `src/lib/store/gym-store.test.ts` | New |
| `src/lib/ai/exercise-resolver.ts` | New — fuzzy name matching |
| `src/lib/ai/exercise-resolver.test.ts` | New |
| `src/lib/ai/response-parser.ts` | New — extract JSON from AI text |
| `src/lib/ai/response-parser.test.ts` | New |
| `src/lib/ai/system-prompt-v2.ts` | New — parser-focused prompt |
| `src/components/v2/chat-interface.tsx` | New |
| `src/components/v2/tracker.tsx` | New — reads from Zustand, shows sets AND cardio |
| `src/components/v2/undo-toast.tsx` | New |

## Out of Scope

- Voice input
- Offline/IndexedDB
- Progress charts
- Plan generation
- Multi-day history
- Conversation persistence
- DOMS diagnostics
