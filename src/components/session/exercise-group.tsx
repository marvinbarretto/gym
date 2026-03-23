'use client'

import styles from './exercise-group.module.scss'

interface SetRow {
  id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
}

interface ExerciseGroupProps {
  name: string
  sets: SetRow[]
}

export function ExerciseGroup({ name, sets }: ExerciseGroupProps) {
  return (
    <div className={styles.group}>
      <div className={styles.name}>{name}</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Set</th>
            <th>Reps</th>
            <th>KG</th>
            <th>RPE</th>
          </tr>
        </thead>
        <tbody>
          {sets.map(set => (
            <tr key={set.id}>
              <td>{set.set_number}</td>
              <td>{set.reps ?? '—'}</td>
              <td>{set.weight_kg ?? '—'}</td>
              <td>{set.rpe ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
