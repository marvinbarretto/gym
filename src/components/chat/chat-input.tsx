'use client'

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import styles from './chat-input.module.scss'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
