# Session Experience Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the gym PWA session experience with two-mode architecture (free chat vs session mode), conversation persistence, stacked session tracker with inline editing, equipment-first AI vocabulary, toast notifications, and vault integration.

**Architecture:** The chat page becomes mode-aware — detecting open sessions on load, offering Start Session / Resume / Close. Session mode adds a collapsible tracker panel above the chat. All conversations persist to Supabase. Tool calls fire toast notifications. The system prompt loads equipment names as the canonical vocabulary.

**Tech Stack:** Next.js 16, AI SDK v6, Supabase (gym schema), SCSS/CSS Modules, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-session-experience-redesign.md`

---

## Phase 1: Conversation Persistence + Session Lifecycle

### Task 0: Schema Migration — Fix Conversation Constraints + Add Indexes

**Files:**
- Create: `supabase/migrations/20260323120000_conversation_constraints.sql`

The `conversations` and `conversation_messages` tables already exist but need constraint fixes: the `role` CHECK only allows `('user', 'assistant')` and `content` is `NOT NULL`. We need to support `'system'` and `'tool'` roles, nullable content (tool-only messages), and add performance indexes.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260323120000_conversation_constraints.sql

-- Expand role constraint to include system and tool messages
ALTER TABLE gym.conversation_messages
  DROP CONSTRAINT IF EXISTS conversation_messages_role_check;
ALTER TABLE gym.conversation_messages
  ADD CONSTRAINT conversation_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system', 'tool'));

-- Allow nullable content for tool-only messages
ALTER TABLE gym.conversation_messages
  ALTER COLUMN content DROP NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv
  ON gym.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session
  ON gym.conversations(session_id) WHERE session_id IS NOT NULL;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or apply via Supabase dashboard)

- [ ] **Step 3: Regenerate types**

Run: `npx supabase gen types --lang=typescript --linked --schema gym > src/lib/supabase/types.ts`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260323120000_conversation_constraints.sql src/lib/supabase/types.ts
git commit -m "fix: expand conversation_messages role constraint and add indexes"
```

---

### Task 1: Conversation DB Functions

**Files:**
- Create: `src/lib/db/conversations.ts`
- Test: `src/lib/db/conversations.test.ts`

We need the query layer for conversations.

- [ ] **Step 1: Write failing tests for conversation CRUD**

```typescript
// src/lib/db/conversations.test.ts
import { describe, it, expect } from 'vitest'
import { buildCreateConversation, buildGetConversation, buildAddMessage, buildGetMessages } from './conversations'

describe('conversations', () => {
  it('buildCreateConversation returns correct insert shape', () => {
    const result = buildCreateConversation({
      userId: 'user-1',
      type: 'session',
      sessionId: 'session-1',
    })
    expect(result.user_id).toBe('user-1')
    expect(result.type).toBe('session')
    expect(result.session_id).toBe('session-1')
  })

  it('buildCreateConversation defaults sessionId to null for free chat', () => {
    const result = buildCreateConversation({
      userId: 'user-1',
      type: 'question',
    })
    expect(result.session_id).toBeNull()
  })

  it('buildAddMessage returns correct insert shape', () => {
    const result = buildAddMessage({
      conversationId: 'conv-1',
      role: 'user',
      content: 'hello',
    })
    expect(result.conversation_id).toBe('conv-1')
    expect(result.role).toBe('user')
    expect(result.content).toBe('hello')
    expect(result.tool_calls).toBeNull()
  })

  it('buildAddMessage includes tool_calls when provided', () => {
    const toolCalls = [{ toolName: 'log_set', args: { reps: 10 } }]
    const result = buildAddMessage({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Logged.',
      toolCalls,
    })
    expect(result.tool_calls).toEqual(toolCalls)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/db/conversations.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement conversation DB functions**

```typescript
// src/lib/db/conversations.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

type ConversationType = 'session' | 'check_in' | 'planning' | 'question'

export function buildCreateConversation(data: {
  userId: string
  type: ConversationType
  sessionId?: string
}) {
  return {
    user_id: data.userId,
    type: data.type,
    session_id: data.sessionId ?? null,
  }
}

export function buildAddMessage(data: {
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  toolCalls?: unknown[]
}) {
  return {
    conversation_id: data.conversationId,
    role: data.role,
    content: data.content,
    tool_calls: data.toolCalls ?? null,
  }
}

export async function createConversation(supabase: Supabase, data: {
  userId: string
  type: ConversationType
  sessionId?: string
}) {
  return supabase.from('conversations')
    .insert(buildCreateConversation(data))
    .select()
    .single()
}

export async function addMessage(supabase: Supabase, data: {
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  toolCalls?: unknown[]
}) {
  return supabase.from('conversation_messages')
    .insert(buildAddMessage(data))
    .select()
    .single()
}

export async function getConversation(supabase: Supabase, conversationId: string) {
  return supabase.from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()
}

export async function getConversationBySession(supabase: Supabase, sessionId: string) {
  return supabase.from('conversations')
    .select('*')
    .eq('session_id', sessionId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
}

export async function getMessages(supabase: Supabase, conversationId: string) {
  return supabase.from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500)
}

export async function getOpenSession(supabase: Supabase, userId: string) {
  return supabase.from('sessions')
    .select('id, started_at, gym_id, user_gyms(name)')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

export async function endConversation(supabase: Supabase, conversationId: string) {
  return supabase.from('conversations')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', conversationId)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/db/conversations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/conversations.ts src/lib/db/conversations.test.ts
git commit -m "feat: add conversation persistence DB functions"
```

---

### Task 2: Wire Conversation Persistence into Chat API

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Create: `src/app/api/conversations/route.ts` (for loading messages on page init)

- [ ] **Step 1: Add conversation management to chat API route**

Modify `src/app/api/chat/route.ts` to:
- Accept an optional `conversationId` in the request body
- If no `conversationId`, create a new conversation (type based on whether there's an active session)
- Persist each user message and assistant response to `conversation_messages`
- Return `conversationId` in the response headers so the client can track it

Key changes to `POST` handler:
```typescript
const { messages, conversationId: existingConvId, sessionId }:
  { messages: UIMessage[]; conversationId?: string; sessionId?: string } = await request.json()

// Create or reuse conversation
let conversationId = existingConvId
if (!conversationId) {
  const { data: conv } = await createConversation(supabase, {
    userId: user.id,
    type: sessionId ? 'session' : 'question',
    sessionId,
  })
  conversationId = conv?.id
}

// Persist the latest user message
const lastUserMsg = messages.filter(m => m.role === 'user').at(-1)
if (lastUserMsg && conversationId) {
  const textContent = lastUserMsg.parts
    ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('') ?? ''
  await addMessage(supabase, {
    conversationId,
    role: 'user',
    content: textContent,
  }).catch(err => console.error('[chat] failed to persist user message:', err))
}
```

In `onStepFinish`, persist assistant messages and tool calls:
```typescript
onStepFinish: (event) => {
  // ... existing logging ...
  if (conversationId) {
    if (event.text) {
      addMessage(supabase, {
        conversationId,
        role: 'assistant',
        content: event.text,
        toolCalls: event.toolCalls?.length ? event.toolCalls : undefined,
      }).catch(err => console.error('[chat] failed to persist assistant message:', err))
    }
    if (event.toolResults?.length) {
      addMessage(supabase, {
        conversationId,
        role: 'tool',
        content: null,
        toolCalls: event.toolResults,
      }).catch(err => console.error('[chat] failed to persist tool results:', err))
    }
  }
}
```

Add `conversationId` to response headers:
```typescript
const response = result.toUIMessageStreamResponse()
if (conversationId) {
  response.headers.set('X-Conversation-Id', conversationId)
}
return response
```

- [ ] **Step 2: Create conversations API route for loading history**

```typescript
// src/app/api/conversations/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getMessages, getOpenSession, getConversationBySession } from '@/lib/db/conversations'

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(request.url)
  const conversationId = url.searchParams.get('conversationId')
  const sessionId = url.searchParams.get('sessionId')

  if (conversationId) {
    const { data, error } = await getMessages(supabase, conversationId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ messages: data })
  }

  if (sessionId) {
    const { data: conv } = await getConversationBySession(supabase, sessionId)
    if (conv) {
      const { data: msgs } = await getMessages(supabase, conv.id)
      return Response.json({ conversationId: conv.id, messages: msgs ?? [] })
    }
    return Response.json({ conversationId: null, messages: [] })
  }

  return Response.json({ messages: [] })
}
```

- [ ] **Step 3: Test manually — send a chat message, verify rows in conversation_messages**

Run: `npm run dev`
Open chat, send a message, check Supabase dashboard for new rows in `conversations` and `conversation_messages`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts src/app/api/conversations/route.ts
git commit -m "feat: persist conversations and messages to supabase"
```

---

### Task 3: Session Lifecycle — Open Session Detection + Start/End Buttons

**Files:**
- Create: `src/lib/hooks/use-session.ts`
- Create: `src/app/api/sessions/active/route.ts`
- Modify: `src/app/chat/page.tsx`

- [ ] **Step 1: Create active session API route**

```typescript
// src/app/api/sessions/active/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOpenSession } from '@/lib/db/conversations'
import { createSession, endSession } from '@/lib/db/sessions'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await getOpenSession(supabase, user.id)
  return Response.json({ session: data })
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Auto-select the user's only gym
  const { data: gyms } = await supabase
    .from('user_gyms')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  const gymId = gyms?.[0]?.id ?? null

  const { data, error } = await createSession(supabase, {
    userId: user.id,
    gymId,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ session: data })
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { action, sessionId } = await request.json()
  if (action === 'end' && sessionId) {
    const { data, error } = await endSession(supabase, sessionId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ session: data })
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 })
}
```

- [ ] **Step 2: Create useSession hook**

```typescript
// src/lib/hooks/use-session.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

interface ActiveSession {
  id: string
  started_at: string
  gym_id: string | null
  user_gyms: { name: string } | null
}

export function useSession() {
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showResumePrompt, setShowResumePrompt] = useState(false)

  useEffect(() => {
    fetch('/api/sessions/active')
      .then(r => r.json())
      .then(({ session }) => {
        if (session) {
          setSession(session)
          setShowResumePrompt(true)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const startSession = useCallback(async () => {
    const res = await fetch('/api/sessions/active', { method: 'POST' })
    const { session } = await res.json()
    setSession(session)
    setShowResumePrompt(false)
    return session
  }, [])

  const endCurrentSession = useCallback(async () => {
    if (!session) return
    await fetch('/api/sessions/active', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end', sessionId: session.id }),
    })
    setSession(null)
    setShowResumePrompt(false)
  }, [session])

  const resumeSession = useCallback(() => {
    setShowResumePrompt(false)
  }, [])

  const dismissSession = useCallback(async () => {
    await endCurrentSession()
  }, [endCurrentSession])

  return {
    session,
    loading,
    showResumePrompt,
    startSession,
    endCurrentSession,
    resumeSession,
    dismissSession,
    isInSession: !!session && !showResumePrompt,
  }
}
```

- [ ] **Step 3: Update chat page to be mode-aware**

Modify `src/app/chat/page.tsx` to pass session state down:

```tsx
// src/app/chat/page.tsx
'use client'

import { ChatInterface } from '@/components/chat/chat-interface'
import { useSession } from '@/lib/hooks/use-session'
import styles from './page.module.scss'

export default function ChatPage() {
  const sessionState = useSession()

  if (sessionState.loading) return null

  return (
    <div className={styles.container}>
      {sessionState.showResumePrompt && sessionState.session && (
        <div className={styles.resumePrompt}>
          <p>You have an open session from {new Date(sessionState.session.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.</p>
          <div className={styles.resumeActions}>
            <button onClick={sessionState.resumeSession}>Resume</button>
            <button onClick={sessionState.dismissSession} className={styles.secondary}>Close it</button>
          </div>
        </div>
      )}
      <ChatInterface
        session={sessionState.session}
        isInSession={sessionState.isInSession}
        onStartSession={sessionState.startSession}
        onEndSession={sessionState.endCurrentSession}
      />
    </div>
  )
}
```

Create `src/app/chat/page.module.scss`:
```scss
.container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.resumePrompt {
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
  text-align: center;

  p {
    color: var(--color-muted, #999);
    margin-bottom: 0.75rem;
  }
}

.resumeActions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;

  button {
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, #333);
    background: var(--color-surface, #1a1a1a);
    color: var(--color-text, #e0e0e0);
    cursor: pointer;
    font-size: 0.875rem;

    &:hover {
      background: var(--color-border, #333);
    }
  }

  .secondary {
    color: var(--color-muted, #999);
  }
}
```

- [ ] **Step 4: Update ChatInterface to accept session props**

Modify `src/components/chat/chat-interface.tsx` to accept `session`, `isInSession`, `onStartSession`, `onEndSession` props. For now, just pass them through and show a "Start Session" button when not in session. The tracker UI comes in Phase 2.

```tsx
// Update ChatInterface props
interface ChatInterfaceProps {
  session: { id: string; started_at: string } | null
  isInSession: boolean
  onStartSession: () => Promise<unknown>
  onEndSession: () => Promise<void>
}
```

Add a "Start Session" button above the chat input when not in session:
```tsx
{!isInSession && (
  <button className={styles.startSession} onClick={onStartSession}>
    Start Session
  </button>
)}
```

Pass `sessionId` and `conversationId` through to `useChat` via a custom transport. Track `conversationId` in state, reading it from the `X-Conversation-Id` response header:

```tsx
const [conversationId, setConversationId] = useState<string | null>(null)

const { messages, status, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
    body: { sessionId: session?.id ?? null, conversationId },
    onResponse: (response) => {
      const convId = response.headers.get('X-Conversation-Id')
      if (convId) setConversationId(convId)
    },
  }),
})
```

Note: `body` and `onResponse` are configured on the transport in AI SDK v6, not on `useChat` directly.

- [ ] **Step 5: Test manually — verify open session detection, start/end flow**

Run: `npm run dev`
1. Open chat — should see "Start Session" button, no resume prompt
2. Click Start Session — button disappears (session created in DB)
3. Reload page — should see "Resume or Close" prompt
4. Click Resume — back in session mode
5. Reload again, click Close — session ended, back to free chat

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks/use-session.ts src/app/api/sessions/active/route.ts src/app/chat/page.tsx src/app/chat/page.module.scss src/components/chat/chat-interface.tsx
git commit -m "feat: add session lifecycle with start/resume/close flow"
```

---

### Task 4: Mode-Aware Tool Selection

**Files:**
- Modify: `src/lib/ai/tools.ts`
- Modify: `src/app/api/chat/route.ts`
- Create: `src/lib/ai/tools-free-chat.ts`

- [ ] **Step 1: Create free chat tools (record_check_in + read-only tools)**

```typescript
// src/lib/ai/tools-free-chat.ts
import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { searchExercises, getExerciseHistory } from '@/lib/db/exercises'
import { getEquipment } from '@/lib/db/equipment'

type Supabase = SupabaseClient<Database, 'gym'>

export function createFreeChatTools(supabase: Supabase, userId: string) {
  return {
    record_check_in: tool({
      description: 'Record a body check-in — soreness, energy, sleep quality. Use when the user mentions soreness, fatigue, or recovery. Infer values from conversation.',
      inputSchema: z.object({
        check_in_date: z.string().describe('ISO date string for the check-in (default today)'),
        soreness_map: z.record(z.string(), z.number().min(1).max(5))
          .describe('Muscle group name → soreness level 1-5. e.g. {"chest": 3, "shoulders": 2}'),
        energy: z.number().min(1).max(5).optional().describe('Overall energy level 1-5, inferred from conversation'),
        sleep_quality: z.number().min(1).max(5).optional().describe('Sleep quality 1-5, if mentioned'),
        notes: z.string().optional().describe('Free text notes about how they feel'),
      }),
      execute: async (input) => {
        const { data, error } = await supabase.from('body_check_ins').insert({
          user_id: userId,
          check_in_date: input.check_in_date,
          soreness_map: input.soreness_map,
          energy: input.energy ?? null,
          sleep_quality: input.sleep_quality ?? null,
          notes: input.notes ?? null,
        }).select().single()
        if (error) return { error: error.message }
        return { checkInId: data.id, message: 'Check-in recorded' }
      },
    }),

    get_exercise_history: tool({
      description: 'Get recent history for a specific exercise. Use to answer questions about past performance.',
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
        muscle_group_id: z.number().int().optional(),
        equipment_type: z.enum(['machine', 'free_weight', 'cable', 'bodyweight', 'cardio']).optional(),
        movement_type: z.enum(['compound', 'isolation']).optional(),
        query: z.string().optional(),
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
      description: 'List equipment available at the gym.',
      inputSchema: z.object({
        gym_id: z.string().uuid(),
      }),
      execute: async (input) => {
        const { data, error } = await getEquipment(supabase, input.gym_id)
        if (error) return { error: error.message }
        return { equipment: data }
      },
    }),
  }
}
```

- [ ] **Step 2: Update chat API route to select tools by mode**

In `src/app/api/chat/route.ts`, read `sessionId` from the request body and select tools accordingly:

```typescript
const { messages, conversationId: existingConvId, sessionId }:
  { messages: UIMessage[]; conversationId?: string; sessionId?: string } = await request.json()

// Select tools based on mode
if (sessionId) {
  // Session mode — logging tools + read tools, but NOT start_session (UI handles that)
  const sessionTools = createGymTools(supabase, user.id)
  const { start_session, ...tools } = sessionTools  // eslint-disable-line @typescript-eslint/no-unused-vars
  // end_session is kept — user can say "I'm done" in chat
} else {
  // Free chat — read-only + check-in
  const tools = createFreeChatTools(supabase, user.id)
}
```

Note: `start_session` is removed from the session tool set because the UI creates sessions explicitly via the "Start Session" button. `end_session` is kept so the user can end a session conversationally ("I'm done").

- [ ] **Step 3: Test manually — verify free chat has no logging tools, session mode has all tools**

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/tools-free-chat.ts src/app/api/chat/route.ts
git commit -m "feat: mode-aware tool selection (free chat vs session)"
```

---

## Phase 2: Session Mode UI — Stacked Tracker + Toasts

### Task 5: Toast Notification System

**Files:**
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/toast.module.scss`
- Create: `src/lib/hooks/use-toasts.ts`

- [ ] **Step 1: Create toast hook**

```typescript
// src/lib/hooks/use-toasts.ts
'use client'

import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'warning' | 'error'
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}
```

- [ ] **Step 2: Create toast component**

```tsx
// src/components/ui/toast.tsx
'use client'

import type { Toast } from '@/lib/hooks/use-toasts'
import styles from './toast.module.scss'

interface ToastContainerProps {
  toasts: Toast[]
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
```

```scss
// src/components/ui/toast.module.scss
.container {
  position: fixed;
  bottom: 5rem; // above bottom nav
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 100;
  pointer-events: none;
  max-width: 90vw;
}

.toast {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  animation: slideUp 0.2s ease-out;
  white-space: nowrap;
}

.success {
  background: #1a3a1a;
  border: 1px solid #2d5a2d;
}

.warning {
  background: #3a3a1a;
  border: 1px solid #5a5a2d;
}

.error {
  background: #3a1a1a;
  border: 1px solid #5a2d2d;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Write test for useToasts**

```typescript
// src/lib/hooks/use-toasts.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToasts } from './use-toasts'

describe('useToasts', () => {
  it('adds and auto-removes toasts', async () => {
    const { result } = renderHook(() => useToasts())

    act(() => { result.current.addToast('Test message', 'success') })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Test message')
    expect(result.current.toasts[0].type).toBe('success')
  })

  it('removeToast removes by id', () => {
    const { result } = renderHook(() => useToasts())

    act(() => { result.current.addToast('msg1', 'success') })
    const id = result.current.toasts[0].id
    act(() => { result.current.removeToast(id) })
    expect(result.current.toasts).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/hooks/use-toasts.test.ts`
Expected: PASS

Note: Requires `@testing-library/react` as a dev dependency. If not installed: `npm install -D @testing-library/react @testing-library/dom`

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/toast.tsx src/components/ui/toast.module.scss src/lib/hooks/use-toasts.ts src/lib/hooks/use-toasts.test.ts
git commit -m "feat: add toast notification system"
```

---

### Task 6: Session Tracker Panel

**Files:**
- Create: `src/components/session/tracker.tsx`
- Create: `src/components/session/tracker.module.scss`
- Create: `src/components/session/exercise-group.tsx`
- Create: `src/components/session/exercise-group.module.scss`
- Create: `src/lib/hooks/use-session-sets.ts`

- [ ] **Step 1: Create useSessionSets hook for polling session data**

```typescript
// src/lib/hooks/use-session-sets.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

interface SessionSet {
  id: string
  exercise_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  duration_s: number | null
  notes: string | null
  exercises: { name: string } | null
}

interface ExerciseGroup {
  exerciseId: string
  exerciseName: string
  sets: SessionSet[]
}

export function useSessionSets(sessionId: string | null) {
  const [sets, setSets] = useState<SessionSet[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      const { session } = await res.json()
      setSets(session?.session_sets ?? [])
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Group sets by exercise
  const groups: ExerciseGroup[] = []
  const seen = new Map<string, ExerciseGroup>()
  const order: string[] = []

  for (const set of sets) {
    const key = set.exercise_id
    if (!seen.has(key)) {
      const group: ExerciseGroup = {
        exerciseId: key,
        exerciseName: set.exercises?.name ?? 'Unknown',
        sets: [],
      }
      seen.set(key, group)
      order.push(key)
    }
    seen.get(key)!.sets.push(set)
  }

  for (const key of order) {
    groups.push(seen.get(key)!)
  }

  return { sets, groups, loading, refetch }
}
```

- [ ] **Step 2: Create ExerciseGroup component**

```tsx
// src/components/session/exercise-group.tsx
'use client'

import styles from './exercise-group.module.scss'

interface SetRow {
  id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
}

interface ExerciseGroupProps {
  name: string
  sets: SetRow[]
}

export function ExerciseGroup({ name, sets }: ExerciseGroupProps) {
  return (
    <div className={styles.group}>
      <div className={styles.name}>{name}</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Set</th>
            <th>Reps</th>
            <th>KG</th>
            <th>RPE</th>
          </tr>
        </thead>
        <tbody>
          {sets.map(set => (
            <tr key={set.id}>
              <td>{set.set_number}</td>
              <td>{set.reps ?? '—'}</td>
              <td>{set.weight_kg ?? '—'}</td>
              <td>{set.rpe ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

```scss
// src/components/session/exercise-group.module.scss
.group {
  margin-bottom: 0.75rem;
}

.name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #e0e0e0);
  margin-bottom: 0.25rem;
}

.table {
  width: 100%;
  font-size: 0.75rem;
  color: var(--color-muted, #999);
  border-collapse: collapse;

  th {
    text-align: left;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-muted, #666);
    padding: 0.125rem 0;
  }

  td {
    padding: 0.125rem 0;
  }
}
```

- [ ] **Step 3: Create Tracker panel component**

```tsx
// src/components/session/tracker.tsx
'use client'

import { useState } from 'react'
import { ExerciseGroup } from './exercise-group'
import type { useSessionSets } from '@/lib/hooks/use-session-sets'
import styles from './tracker.module.scss'

interface TrackerProps {
  session: { id: string; started_at: string }
  groups: ReturnType<typeof useSessionSets>['groups']
  totalSets: number
  onEndSession: () => Promise<void>
}

export function Tracker({ session, groups, totalSets, onEndSession }: TrackerProps) {
  const [expanded, setExpanded] = useState(true)
  const prevGroupCount = useRef(groups.length)
  const elapsed = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)

  // Auto-expand when a new exercise group is added
  useEffect(() => {
    if (groups.length > prevGroupCount.current) {
      setExpanded(true)
    }
    prevGroupCount.current = groups.length
  }, [groups.length])

  if (!expanded) {
    return (
      <div className={styles.collapsed} onClick={() => setExpanded(true)}>
        <span>{groups.length} exercises · {totalSets} sets · {elapsed}min</span>
        <span className={styles.expand}>▲ expand</span>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.date}>
            {new Date(session.started_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <span className={styles.elapsed}>{elapsed}min</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.collapse} onClick={() => setExpanded(false)}>▼</button>
          <button className={styles.endBtn} onClick={onEndSession}>End Session</button>
        </div>
      </div>
      <div className={styles.body}>
        {groups.length === 0 && (
          <div className={styles.empty}>No exercises logged yet</div>
        )}
        {groups.map(g => (
          <ExerciseGroup key={g.exerciseId} name={g.exerciseName} sets={g.sets} />
        ))}
      </div>
    </div>
  )
}
```

```scss
// src/components/session/tracker.module.scss
.panel {
  background: var(--color-surface, #1a1a1a);
  border-bottom: 1px solid var(--color-border, #333);
  max-height: 40vh;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  position: sticky;
  top: 0;
  background: var(--color-surface, #1a1a1a);
  z-index: 1;
}

.headerLeft {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.date {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #e0e0e0);
}

.elapsed {
  font-size: 0.75rem;
  color: var(--color-muted, #999);
}

.headerRight {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.collapse {
  background: none;
  border: none;
  color: var(--color-muted, #666);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.75rem;
}

.endBtn {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  border: 1px solid #5a2d2d;
  background: #3a1a1a;
  color: #e0a0a0;
  cursor: pointer;

  &:hover {
    background: #4a2a2a;
  }
}

.body {
  padding: 0 1rem 0.75rem;
}

.empty {
  font-size: 0.8125rem;
  color: var(--color-muted, #666);
  padding: 0.5rem 0;
}

.collapsed {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 1rem;
  background: var(--color-surface, #1a1a1a);
  border-bottom: 1px solid var(--color-border, #333);
  font-size: 0.8125rem;
  color: var(--color-muted, #999);
  cursor: pointer;

  &:hover {
    background: var(--color-border, #222);
  }
}

.expand {
  color: #e8c547;
  font-size: 0.75rem;
}
```

- [ ] **Step 4: Extract and test grouping logic**

Extract the grouping logic from `useSessionSets` into a pure function `groupSetsByExercise` and test it:

```typescript
// src/lib/hooks/use-session-sets.test.ts
import { describe, it, expect } from 'vitest'
import { groupSetsByExercise } from './use-session-sets'

describe('groupSetsByExercise', () => {
  it('groups sets by exercise_id preserving log order', () => {
    const sets = [
      { id: '1', exercise_id: 'ex-a', set_number: 1, reps: 10, weight_kg: 25, rpe: 5, duration_s: null, notes: null, exercises: { name: 'Chest Press' } },
      { id: '2', exercise_id: 'ex-a', set_number: 2, reps: 10, weight_kg: 25, rpe: 8, duration_s: null, notes: null, exercises: { name: 'Chest Press' } },
      { id: '3', exercise_id: 'ex-b', set_number: 1, reps: 5, weight_kg: 15, rpe: 5, duration_s: null, notes: null, exercises: { name: 'Shoulder Press' } },
    ]
    const groups = groupSetsByExercise(sets)
    expect(groups).toHaveLength(2)
    expect(groups[0].exerciseName).toBe('Chest Press')
    expect(groups[0].sets).toHaveLength(2)
    expect(groups[1].exerciseName).toBe('Shoulder Press')
    expect(groups[1].sets).toHaveLength(1)
  })

  it('returns empty array for no sets', () => {
    expect(groupSetsByExercise([])).toEqual([])
  })
})
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/hooks/use-session-sets.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/session/tracker.tsx src/components/session/tracker.module.scss src/components/session/exercise-group.tsx src/components/session/exercise-group.module.scss src/lib/hooks/use-session-sets.ts src/lib/hooks/use-session-sets.test.ts
git commit -m "feat: add stacked session tracker with grouped exercises"
```

---

### Task 7: Wire Tracker + Toasts into ChatInterface

**Files:**
- Modify: `src/components/chat/chat-interface.tsx`
- Modify: `src/components/chat/chat-interface.module.scss`
- Modify: `src/app/api/sessions/[id]/route.ts` (ensure GET returns sets)

- [ ] **Step 1: Update ChatInterface to render tracker and toasts when in session**

The ChatInterface now:
- Shows Tracker above messages when `isInSession`
- Shows "Start Session" button when not in session
- Uses `useSessionSets` to feed the tracker
- Uses `useToasts` for tool call notifications
- Refetches session sets after each AI response completes (via `useChat` `onFinish`)
- Reads `X-Conversation-Id` from response headers to track conversation

Key structural change to the component:
```tsx
export function ChatInterface({ session, isInSession, onStartSession, onEndSession }: ChatInterfaceProps) {
  const { messages, status, sendMessage } = useChat({
    // Pass sessionId and conversationId to the API
  })
  const { groups, sets, refetch } = useSessionSets(isInSession ? session?.id ?? null : null)
  const { toasts, addToast } = useToasts()

  // Refetch tracker when AI finishes responding
  // Parse tool call parts from messages to fire toasts

  return (
    <div className={styles.container}>
      {isInSession && session && (
        <Tracker
          session={session}
          groups={groups}
          totalSets={sets.length}
          onEndSession={onEndSession}
        />
      )}
      <div className={styles.messages} ref={scrollRef}>
        {/* ... existing message rendering ... */}
      </div>
      {!isInSession && (
        <button className={styles.startSession} onClick={onStartSession}>
          Start Session
        </button>
      )}
      <ChatInput onSend={(text) => sendMessage({ text })} isLoading={isLoading} />
      <ToastContainer toasts={toasts} />
    </div>
  )
}
```

- [ ] **Step 2: Add toast firing from tool call parts in messages**

Watch message parts for tool results and fire toasts. In AI SDK v6, tool parts use `type: 'tool-<toolName>'` (e.g. `tool-log_set`, `tool-search_exercises`):
```typescript
// In a useEffect watching messages — track which tool calls we've already toasted
const toastedRef = useRef(new Set<string>())

useEffect(() => {
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue
    for (const part of msg.parts ?? []) {
      if (part.type.startsWith('tool-') && part.state === 'output-available' && !toastedRef.current.has(part.toolCallId)) {
        toastedRef.current.add(part.toolCallId)
        const toolName = part.type.replace('tool-', '')
        addToast(formatToolToast(toolName, part.output), 'success')
      }
    }
  }
}, [messages])
```

- [ ] **Step 3: Update sessions/[id] API route to return wrapped response**

The existing `GET /api/sessions/:id` returns the session object directly. Update it to wrap in `{ session: data }` so `useSessionSets` can destructure correctly:

```typescript
// src/app/api/sessions/[id]/route.ts — update GET handler
return Response.json({ session: data })
```

Also ensure the response includes `session_sets(*, exercises(name))` for the tracker.

- [ ] **Step 4: Test end-to-end — start session, chat, see tracker update, see toasts**

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/chat-interface.tsx src/components/chat/chat-interface.module.scss src/app/api/sessions/[id]/route.ts
git commit -m "feat: wire tracker and toasts into chat interface"
```

---

## Phase 3: Inline Editing + Equipment-First Vocabulary

### Task 8: Inline Set Editing

**Files:**
- Modify: `src/components/session/exercise-group.tsx`
- Modify: `src/components/session/exercise-group.module.scss`
- Create: `src/lib/db/sets.ts` (direct set update/delete)

- [ ] **Step 1: Create set update/delete DB functions**

```typescript
// src/lib/db/sets.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Supabase = SupabaseClient<Database, 'gym'>

export async function updateSet(supabase: Supabase, setId: string, data: {
  exerciseId?: string
  reps?: number | null
  weightKg?: number | null
  rpe?: number | null
}) {
  const update: Record<string, unknown> = {}
  if (data.exerciseId !== undefined) update.exercise_id = data.exerciseId
  if (data.reps !== undefined) update.reps = data.reps
  if (data.weightKg !== undefined) update.weight_kg = data.weightKg
  if (data.rpe !== undefined) update.rpe = data.rpe

  return supabase.from('session_sets')
    .update(update)
    .eq('id', setId)
    .select()
    .single()
}

export async function deleteSet(supabase: Supabase, setId: string) {
  return supabase.from('session_sets')
    .delete()
    .eq('id', setId)
}
```

- [ ] **Step 2: Create API route for set mutations**

```typescript
// src/app/api/sets/[id]/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateSet, deleteSet } from '@/lib/db/sets'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await request.json()
  const { data, error } = await updateSet(supabase, id, body)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ set: data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { error } = await deleteSet(supabase, id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Add inline editing to ExerciseGroup component**

Add edit state per row. Tap ✎ → fields become inputs. Save on blur/enter via `PATCH /api/sets/:id`. Delete via trash icon → `DELETE /api/sets/:id`. Call `onRefetch` prop after mutations to update the tracker.

- [ ] **Step 4: Test — edit a set's reps, verify DB update, verify tracker refreshes**

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/sets.ts src/app/api/sets/[id]/route.ts src/components/session/exercise-group.tsx src/components/session/exercise-group.module.scss
git commit -m "feat: inline set editing with direct DB updates"
```

---

### Task 9: Equipment-First System Prompt + Equipment Audit

**Files:**
- Modify: `src/lib/ai/system-prompt.ts`
- Create: `scripts/audit-equipment.sql` (update equipment names)

- [ ] **Step 1: Update system prompt to load equipment and set tone**

Modify `buildSystemPrompt` in `src/lib/ai/system-prompt.ts`:

1. Load equipment list for the user's gym and include names in the prompt
2. Update the `BASE_PROMPT` to reflect the quiet-logger tone and equipment-first vocabulary
3. Add recent conversation summary for context continuity

Key additions to `BASE_PROMPT`:
```
Conversation style:
- You are a quiet, efficient logger — not a personal trainer.
- No motivation, no encouragement, no "great job!" or "ready for next set?".
- Confirm what was logged, ask only what's needed to fill data gaps.
- Keep responses to 1-2 sentences maximum during sessions.

Vocabulary:
- The user thinks in terms of equipment names at their gym. Match input to equipment names first.
- Always respond with the canonical equipment/exercise name. This teaches the user correct terminology through repetition, not correction.
- Accept loose descriptions gracefully. Don't ask for clarification unless genuinely ambiguous between two machines.
```

Add equipment loading:
```typescript
// Load gym equipment
if (gyms?.length) {
  const { data: equipment } = await supabase
    .from('equipment')
    .select('name, type')
    .eq('gym_id', gyms[0].id)
    .limit(50)

  if (equipment?.length) {
    const eqList = equipment.map(e => `  - ${e.name} (${e.type})`).join('\n')
    parts.push(`\nEquipment at this gym:\n${eqList}\n- Match the user's descriptions to these equipment names first.`)
  }
}
```

- [ ] **Step 2: Create equipment audit script**

```sql
-- scripts/audit-equipment.sql
-- Update equipment names to match actual gym machine labels
-- Run manually against Supabase: supabase db execute < scripts/audit-equipment.sql

-- First, identify current equipment for the user's gym
-- SELECT id, name, type FROM gym.equipment WHERE gym_id = 'b9aa4c9d-5223-488d-a881-12c6c65409e2';

-- Update names to match physical machine labels
-- These are the canonical names the user sees at their gym:
-- Chest Press, Shoulder Press, Standing Leg Curl, Standing Calf Raise,
-- Tricep Extension, Dual Adjustment Pulley, Lateral Seated Row

-- Example updates (IDs will need to be verified):
-- UPDATE gym.equipment SET name = 'Chest Press' WHERE name = 'Chest Press Machine' AND gym_id = 'b9aa4c9d-5223-488d-a881-12c6c65409e2';
-- UPDATE gym.equipment SET name = 'Shoulder Press' WHERE name LIKE '%Shoulder Press%' AND gym_id = 'b9aa4c9d-5223-488d-a881-12c6c65409e2';

-- NOTE: Run SELECT first to map existing names → canonical names, then update.
-- The user will add more equipment names over time via the add_equipment tool.
```

- [ ] **Step 3: Test — send a loose description in chat, verify AI responds with canonical name**

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/system-prompt.ts scripts/audit-equipment.sql
git commit -m "feat: equipment-first AI vocabulary and quiet-logger tone"
```

---

## Phase 4: Vault Integration

### Task 10: Vault Event Emitter

**Files:**
- Create: `src/lib/vault/types.ts`
- Create: `src/lib/vault/emit.ts`
- Modify: `src/app/api/chat/route.ts` (emit on session end)

- [ ] **Step 1: Create vault types**

```typescript
// src/lib/vault/types.ts
export interface VaultSessionSummary {
  type: 'gym_session'
  date: string
  duration_min: number
  exercises: string[]
  total_sets: number
  summary: string
  tags: string[]
}

export interface VaultCheckIn {
  type: 'gym_check_in'
  date: string
  soreness: Record<string, number>
  energy: number | null
  notes: string | null
  tags: string[]
}

export interface VaultMilestone {
  type: 'gym_milestone'
  date: string
  kind: 'first_session' | 'new_pr' | 'streak'
  description: string
  tags: string[]
}

export type VaultEvent = VaultSessionSummary | VaultCheckIn | VaultMilestone
```

- [ ] **Step 2: Create vault emitter**

```typescript
// src/lib/vault/emit.ts
import type { VaultEvent } from './types'

const VAULT_API_URL = process.env.JIMBO_VAULT_URL

export async function emitToVault(event: VaultEvent): Promise<void> {
  if (!VAULT_API_URL) {
    console.log('[vault] no JIMBO_VAULT_URL configured, skipping emit:', event.type)
    return
  }

  try {
    const res = await fetch(VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    if (!res.ok) {
      console.error('[vault] emit failed:', res.status, await res.text())
    } else {
      console.log('[vault] emitted:', event.type)
    }
  } catch (err) {
    console.error('[vault] emit error (non-blocking):', err)
  }
}
```

- [ ] **Step 3: Wire vault emission into session end flow**

In the chat API `onFinish` callback, detect when `end_session` was called and emit a session summary:

```typescript
// In onFinish, after existing cost tracking
const endSessionCall = /* check if end_session was in tool calls */
if (endSessionCall) {
  const sessionDetail = await getSessionDetail(supabase, endSessionCall.sessionId)
  emitToVault({
    type: 'gym_session',
    date: sessionDetail.started_at,
    duration_min: /* calculate */,
    exercises: /* unique exercise names */,
    total_sets: sessionDetail.session_sets.length,
    summary: /* AI-generated or constructed */,
    tags: ['gym', 'session'],
  }).catch(() => {}) // fire and forget
}
```

- [ ] **Step 4: Wire vault emission into record_check_in tool**

In `src/lib/ai/tools-free-chat.ts`, after successfully inserting a body check-in, emit to vault:

```typescript
emitToVault({
  type: 'gym_check_in',
  date: input.check_in_date,
  soreness: input.soreness_map,
  energy: input.energy ?? null,
  notes: input.notes ?? null,
  tags: ['gym', 'doms', 'recovery', ...Object.keys(input.soreness_map)],
}).catch(() => {})
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/vault/types.ts src/lib/vault/emit.ts src/app/api/chat/route.ts src/lib/ai/tools-free-chat.ts
git commit -m "feat: vault integration — emit session summaries and check-ins to jimbo"
```

---

## Phase 5: Regenerate Types + Final Verification

### Task 11: Regenerate Supabase Types and Full Test Pass

**Files:**
- Modify: `src/lib/supabase/types.ts` (regenerated)

- [ ] **Step 1: Regenerate types if schema changed**

Run: `npx supabase gen types --lang=typescript --linked --schema gym > src/lib/supabase/types.ts`

Note: The conversation tables already exist, but if any schema changes were made during implementation, regenerate.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run dev server and verify end-to-end**

Run: `npm run dev`

Verify:
1. Open chat → see "Start Session" button, free chat works
2. Start session → tracker appears (empty), chat sends with session tools
3. Log exercises via chat → tracker updates, toasts fire
4. Edit a set inline → DB updates, tracker refreshes
5. End session → tracker disappears, back to free chat
6. Reload mid-session → resume prompt appears
7. Report soreness in free chat → body check-in recorded

- [ ] **Step 4: Commit any type regeneration**

```bash
git add src/lib/supabase/types.ts
git commit -m "chore: regenerate supabase types"
```
