'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { MessageBubble } from '@/components/chat/message-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { useGymStore, type SessionSet, type SessionCardio } from '@/lib/store/gym-store'
import { parseAiResponse } from '@/lib/ai/response-parser'
import styles from './chat-interface.module.scss'

export function V2ChatInterface() {
  const session = useGymStore(s => s.session)
  const addSets = useGymStore(s => s.addSets)
  const addCardio = useGymStore(s => s.addCardio)
  const setActiveModel = useGymStore(s => s.setActiveModel)
  const scrollRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    fetch: async (input, init) => {
      const response = await fetch(input, init)
      const model = response.headers.get('X-Model-Id')
      if (model) setActiveModel(model)
      return response
    },
  }), [setActiveModel])

  // Chat key resets when session changes — clears message history
  const chatKey = session?.id ?? 'no-session'
  const { messages, status, sendMessage } = useChat({ transport, id: chatKey })

  const isLoading = status === 'streaming' || status === 'submitted'

  // When AI finishes a response, parse it and save workout data
  const prevStatus = useRef(status)
  const processedMessages = useRef(new Set<string>())

  const handleAiResponse = useCallback(async (text: string, msgId: string) => {
    if (processedMessages.current.has(msgId)) return
    processedMessages.current.add(msgId)

    if (!session) return

    const { entries } = parseAiResponse(text)
    if (entries.length === 0) return

    console.log('[v2] parsed entries:', entries.length, 'from message:', msgId)

    // Send to parse endpoint
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, entries }),
      })
      const { saved, errors } = await res.json()

      // Update store with saved data
      const newSets: SessionSet[] = []
      const newCardio: SessionCardio[] = []

      for (const item of saved) {
        if (item.type === 'set') {
          newSets.push({
            id: item.id,
            session_id: session.id,
            exercise_id: item.data.exercise_id,
            exercise_name: item.exercise_name,
            set_number: item.data.set_number,
            reps: item.data.reps,
            weight_kg: item.data.weight_kg,
            rpe: item.data.rpe,
            duration_s: item.data.duration_s,
            notes: item.data.notes,
          })
        } else if (item.type === 'cardio') {
          newCardio.push({
            id: item.id,
            session_id: session.id,
            exercise_id: item.data.exercise_id,
            exercise_name: item.exercise_name,
            duration_s: item.data.duration_s,
            distance_km: item.data.distance_km,
            avg_heart_rate: item.data.avg_heart_rate,
            notes: item.data.notes,
          })
        }
      }

      if (newSets.length) addSets(newSets)
      for (const c of newCardio) addCardio(c)

      if (errors.length) {
        console.warn('[v2] parse errors:', errors)
      }

      console.log('[v2] saved:', newSets.length, 'sets,', newCardio.length, 'cardio')
    } catch (err) {
      console.error('[v2] parse request failed:', err)
    }
  }, [session, addSets, addCardio])

  // Watch for AI responses finishing
  useEffect(() => {
    if (prevStatus.current === 'streaming' && status === 'ready') {
      // Find the last assistant message
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
      if (lastAssistant) {
        const text = lastAssistant.parts
          ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map(p => p.text)
          .join('') ?? ''
        if (text) handleAiResponse(text, lastAssistant.id)
      }
    }
    prevStatus.current = status
  }, [status, messages, handleAiResponse])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.container}>
      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <p>{session ? 'Session started. What did you do?' : 'Start a session to begin logging.'}</p>
          </div>
        )}
        {messages.map((msg) => {
          const textContent = msg.parts
            ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('') ?? ''

          if (!textContent) return null

          // For assistant messages, strip JSON blocks from display
          let displayText = textContent
          if (msg.role === 'assistant') {
            displayText = textContent
              .replace(/```(?:json)?\s*\n?[\s\S]*?\n?```/g, '')
              .trim()
            // If the whole message was JSON, try to extract the message field
            if (!displayText && textContent.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(textContent.trim())
                displayText = parsed.message ?? ''
              } catch { /* show nothing */ }
            }
          }

          if (!displayText) return null

          return (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              content={displayText}
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
