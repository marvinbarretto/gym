'use client'

import { useState } from 'react'
import { useGymStore } from '@/lib/store/gym-store'
import styles from './tracker.module.scss'

export function V2Tracker() {
  const session = useGymStore(s => s.session)
  const groups = useGymStore(s => s.exerciseGroups())
  const cardio = useGymStore(s => s.cardio)
  const sets = useGymStore(s => s.sets)
  const [expanded, setExpanded] = useState(true)

  if (!session) return null

  const elapsed = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)
  const totalItems = sets.length + cardio.length

  if (!expanded) {
    return (
      <div className={styles.collapsed} onClick={() => setExpanded(true)}>
        <span>{groups.length + cardio.length} exercises · {totalItems} entries · {elapsed}min</span>
        <span className={styles.expand}>expand</span>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.date}>
            {new Date(session.started_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <span className={styles.elapsed}>{elapsed}min</span>
          <span className={styles.sessionId}>{session.id.slice(0, 8)}</span>
        </div>
        <button className={styles.collapse} onClick={() => setExpanded(false)}>collapse</button>
      </div>
      <div className={styles.body}>
        {totalItems === 0 && (
          <div className={styles.empty}>No exercises logged yet</div>
        )}
        {groups.map(g => (
          <div key={g.exerciseId} className={styles.exerciseGroup}>
            <div className={styles.exerciseName}>{g.exerciseName}</div>
            {g.sets.map(s => (
              <div key={s.id} className={styles.setRow}>
                Set {s.set_number}: {s.reps ?? '—'} reps{s.weight_kg ? ` @ ${s.weight_kg}kg` : ''}{s.rpe ? ` RPE ${s.rpe}` : ''}
              </div>
            ))}
          </div>
        ))}
        {cardio.map(c => (
          <div key={c.id} className={styles.exerciseGroup}>
            <div className={styles.exerciseName}>{c.exercise_name}</div>
            <div className={styles.setRow}>
              {Math.round(c.duration_s / 60)}min{c.distance_km ? ` · ${c.distance_km}km` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
