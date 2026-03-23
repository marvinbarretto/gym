'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useState, useMemo } from 'react'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { StatusBar } from './status-bar'
import { Tracker } from '@/components/session/tracker'
import { ToastContainer } from '@/components/ui/toast'
import { useSessionSets } from '@/lib/hooks/use-session-sets'
import { useToasts } from '@/lib/hooks/use-toasts'
import styles from './chat-interface.module.scss'

interface ChatInterfaceProps {
  session: { id: string; started_at: string } | null
  isInSession: boolean
  onStartSession: () => Promise<unknown>
  onEndSession: () => Promise<void>
}

function formatToolToast(toolName: string, output: unknown): string {
  if (typeof output === 'object' && output !== null && 'message' in output) {
    return String((output as Record<string, unknown>).message)
  }
  const labels: Record<string, string> = {
    log_set: 'Set logged',
    log_cardio: 'Cardio logged',
    end_session: 'Session ended',
    record_check_in: 'Check-in recorded',
    search_exercises: 'Exercises found',
    get_exercise_history: 'History loaded',
    get_equipment: 'Equipment loaded',
    get_todays_plan: 'Plan loaded',
    add_equipment: 'Equipment added',
  }
  return labels[toolName] ?? `${toolName} complete`
}

export function ChatInterface({ session, isInSession, onStartSession, onEndSession }: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const toastedRef = useRef(new Set<string>())

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: {
      sessionId: session?.id ?? null,
      conversationId,
    },
    fetch: async (input, init) => {
      const response = await fetch(input, init)
      const convId = response.headers.get('X-Conversation-Id')
      if (convId) setConversationId(convId)
      return response
    },
  }), [session?.id, conversationId])

  const { messages, status, sendMessage } = useChat({ transport })
  const { groups, sets, refetch } = useSessionSets(isInSession ? session?.id ?? null : null)
  const { toasts, addToast } = useToasts()

  const isLoading = status === 'streaming' || status === 'submitted'

  // Refetch tracker when AI finishes responding
  const prevStatus = useRef(status)
  useEffect(() => {
    if (prevStatus.current === 'streaming' && status === 'ready' && isInSession) {
      refetch()
    }
    prevStatus.current = status
  }, [status, isInSession, refetch])

  // Fire toasts from tool call parts
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue
      for (const part of msg.parts ?? []) {
        if (
          typeof part.type === 'string' &&
          part.type.startsWith('tool-') &&
          'state' in part &&
          part.state === 'output-available' &&
          'toolCallId' in part &&
          !toastedRef.current.has(part.toolCallId as string)
        ) {
          toastedRef.current.add(part.toolCallId as string)
          const toolName = part.type.replace('tool-', '')
          addToast(formatToolToast(toolName, 'output' in part ? part.output : null), 'success')
        }
      }
    }
  }, [messages, addToast])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.container}>
      <StatusBar />
      {isInSession && session && (
        <Tracker
          session={session}
          groups={groups}
          totalSets={sets.length}
          onEndSession={onEndSession}
          onRefetch={refetch}
        />
      )}
      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <p>{isInSession ? 'Session started. Tell me what you\'re working on.' : 'Ready when you are. Tell me about your workout.'}</p>
          </div>
        )}
        {messages.map((msg) => {
          const textContent = msg.parts
            ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('') ?? ''

          if (!textContent) return null

          return (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              content={textContent}
            />
          )
        })}
        {isLoading && (
          <div className={styles.typing}>Thinking...</div>
        )}
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
