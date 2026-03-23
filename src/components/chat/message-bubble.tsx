'use client'

import ReactMarkdown from 'react-markdown'
import styles from './message-bubble.module.scss'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div className={`${styles.bubble} ${styles[role]}`}>
      {role === 'assistant' ? (
        <div className={styles.markdown}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <p>{content}</p>
      )}
    </div>
  )
}
