'use client'

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { useSpeechRecognition } from '@/lib/hooks/use-speech-recognition'
import styles from './chat-input.module.scss'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { supported, listening, transcript, start, stop } = useSpeechRecognition({
    onEnd: (finalText) => {
      // Silence or a stop tap ends the session: send what was heard
      const text = finalText.trim()
      if (text && !isLoading) onSend(text)
      setInput('')
    },
  })

  // Stream the live transcript into the textarea
  useEffect(() => {
    if (listening) setInput(transcript)
  }, [listening, transcript])

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  function submit() {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setInput('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form className={styles.inputBar} onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className={styles.textInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tell me what you did..."
        disabled={isLoading}
        autoFocus
        rows={1}
      />
      {supported && (
        <button
          type="button"
          className={`${styles.micButton} ${listening ? styles.micActive : ''}`}
          onClick={listening ? stop : start}
          disabled={isLoading}
          aria-label={listening ? 'Stop recording' : 'Start voice input'}
          aria-pressed={listening}
        >
          {listening ? 'Stop' : 'Mic'}
        </button>
      )}
      <button
        type="submit"
        className={styles.sendButton}
        disabled={!input.trim() || isLoading}
      >
        Send
      </button>
    </form>
  )
}
