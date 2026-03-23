'use client'

import { useState, type FormEvent } from 'react'
import styles from './chat-input.module.scss'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setInput('')
  }

  return (
    <form className={styles.inputBar} onSubmit={handleSubmit}>
      <input
        type="text"
        className={styles.textInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Tell me what you did..."
        disabled={isLoading}
        autoFocus
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
