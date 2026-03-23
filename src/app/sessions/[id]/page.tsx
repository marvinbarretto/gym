import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionDetail } from '@/lib/db/sessions'
import { SetTable } from '@/components/sessions/set-table'
import { redirect } from 'next/navigation'
import styles from './page.module.scss'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: session, error } = await getSessionDetail(supabase, id)

  if (error || !session) redirect('/sessions')

  const sets = (session.session_sets || []).map((s: {
    exercises: { name: string } | null
    set_number: number
    reps: number | null
    weight_kg: number | null
    rpe: number | null
  }) => ({
    exerciseName: s.exercises?.name ?? 'Unknown',
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
