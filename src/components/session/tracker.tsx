'use client'

import { useState, useRef, useEffect } from 'react'
import { ExerciseGroup } from './exercise-group'
import type { ExerciseGroup as ExerciseGroupType } from '@/lib/hooks/use-session-sets'
import styles from './tracker.module.scss'

interface TrackerProps {
  session: { id: string; started_at: string }
  groups: ExerciseGroupType[]
  totalSets: number
  onEndSession: () => Promise<void>
  onRefetch?: () => void
}

export function Tracker({ session, groups, totalSets, onEndSession, onRefetch }: TrackerProps) {
  const [expanded, setExpanded] = useState(true)
  const prevGroupCount = useRef(groups.length)
  const elapsed = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)

  // Auto-expand when a new exercise group is added
  useEffect(() => {
    if (groups.length > prevGroupCount.current) {
      setExpanded(true)
    }
    prevGroupCount.current = groups.length
  }, [groups.length])

  if (!expanded) {
    return (
      <div className={styles.collapsed} onClick={() => setExpanded(true)}>
        <span>{groups.length} exercises · {totalSets} sets · {elapsed}min</span>
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
        </div>
        <div className={styles.headerRight}>
          <button className={styles.collapse} onClick={() => setExpanded(false)}>collapse</button>
          <button className={styles.endBtn} onClick={onEndSession}>End Session</button>
        </div>
      </div>
      <div className={styles.body}>
        {groups.length === 0 && (
          <div className={styles.empty}>No exercises logged yet</div>
        )}
        {groups.map(g => (
          <ExerciseGroup key={g.exerciseId} name={g.exerciseName} sets={g.sets} onRefetch={onRefetch} />
        ))}
      </div>
    </div>
  )
}
