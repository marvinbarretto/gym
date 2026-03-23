import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getRecentSessions } from '@/lib/db/sessions'
import { SessionCard } from '@/components/sessions/session-card'
import { redirect } from 'next/navigation'
import styles from './page.module.scss'

export default async function SessionsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: sessions } = await getRecentSessions(supabase, user.id, 20)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Sessions</h1>
      <div className={styles.list}>
        {sessions && sessions.length > 0 ? (
          // SessionCard expects a session object with nested session_sets
          sessions.map((session) => (
            <SessionCard key={session.id} session={session as any} />
          ))
        ) : (
          <p className={styles.empty}>No sessions yet. Start one from the chat.</p>
        )}
      </div>
    </div>
  )
}
