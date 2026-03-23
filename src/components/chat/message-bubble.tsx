import styles from './message-bubble.module.scss'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div className={`${styles.bubble} ${styles[role]}`}>
      <p>{content}</p>
    </div>
  )
}
