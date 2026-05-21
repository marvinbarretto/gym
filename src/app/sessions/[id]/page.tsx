import { sessions, exercises as exercisesApi } from '@/lib/api/jimbo-client'
import { SetTable } from '@/components/sessions/set-table'
import { redirect } from 'next/navigation'
import styles from './page.module.scss'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let session
  try {
    session = await sessions.detail(id)
  } catch {
    redirect('/sessions')
  }

  // Hydrate exercise names — the detail endpoint returns exercise_id but not
  // the display name. Catalogue is small (~83), one round-trip per page is fine.
  const catalogue = await exercisesApi.search({ limit: 200 })
  const nameById = new Map(catalogue.map((e) => [e.id, e.name]))

  const sets = session.sets.map((s) => ({
    exerciseName: nameById.get(s.exercise_id) ?? 'Unknown',
    setNumber: s.set_number,
    reps: s.reps,
    weightKg: s.weight_kg,
    rpe: s.rpe,
  }))

  const date = new Date(session.started_at)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h1>
      {session.notes && <p className={styles.notes}>{session.notes}</p>}
      <SetTable sets={sets} />
    </div>
  )
}
