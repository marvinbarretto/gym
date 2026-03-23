import Link from 'next/link'
import styles from './session-card.module.scss'

type SessionSet = {
  exercises: { name: string } | null
}

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  user_gyms?: { name: string } | null
  session_sets?: SessionSet[]
}

type Props = {
  session: Session
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'In progress'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function SessionCard({ session }: Props) {
  const sets = session.session_sets ?? []
  const setCount = sets.length
  const exerciseNames = Array.from(
    new Set(sets.map((s) => s.exercises?.name).filter(Boolean))
  ) as string[]

  return (
    <Link href={`/sessions/${session.id}`} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.date}>{formatDate(session.started_at)}</span>
        <span className={styles.duration}>
          {formatDuration(session.started_at, session.ended_at)}
        </span>
      </div>

      {session.user_gyms?.name && (
        <div className={styles.gym}>{session.user_gyms.name}</div>
      )}

      <div className={styles.stats}>
        <span className={styles.setCount}>
          {setCount} {setCount === 1 ? 'set' : 'sets'}
        </span>
      </div>

      {exerciseNames.length > 0 && (
        <div className={styles.exercises}>
          {exerciseNames.slice(0, 4).join(', ')}
          {exerciseNames.length > 4 && (
            <span className={styles.more}> +{exerciseNames.length - 4} more</span>
          )}
        </div>
      )}
    </Link>
  )
}
