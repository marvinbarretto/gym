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
