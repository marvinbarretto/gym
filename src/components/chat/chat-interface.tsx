'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef } from 'react'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import styles from './chat-interface.module.scss'

export function ChatInterface() {
  // useChat defaults to DefaultChatTransport({ api: '/api/chat' }) — no config needed
  const { messages, status, sendMessage } = useChat()
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
      <ChatInput onSend={(text) => sendMessage({ text })} isLoading={isLoading} />
    </div>
  )
}
