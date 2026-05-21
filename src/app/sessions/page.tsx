import { sessions } from '@/lib/api/jimbo-client'
import { SessionCard } from '@/components/sessions/session-card'
import styles from './page.module.scss'

export default async function SessionsPage() {
  const list = await sessions.list({ limit: 20 })

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Sessions</h1>
      <div className={styles.list}>
        {list.length > 0 ? (
          // SessionCard's set/exercise summary is best-effort — list view
          // shows date + duration only. Detail page has the full set table.
          list.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))
        ) : (
          <p className={styles.empty}>No sessions yet. Start one from the chat.</p>
        )}
      </div>
    </div>
  )
}
