'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useState, useMemo } from 'react'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { StatusBar } from './status-bar'
import styles from './chat-interface.module.scss'

interface ChatInterfaceProps {
  session: { id: string; started_at: string } | null
  isInSession: boolean
  onStartSession: () => Promise<unknown>
  onEndSession: () => Promise<void>
}

export function ChatInterface({ session, isInSession, onStartSession, onEndSession }: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.container}>
      <StatusBar />
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
    </div>
  )
}
