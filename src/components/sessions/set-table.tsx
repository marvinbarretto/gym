import styles from './set-table.module.scss'

interface SetRow {
  exerciseName: string
  setNumber: number
  reps: number | null
  weightKg: number | null
  rpe: number | null
}

interface SetTableProps {
  sets: SetRow[]
}

export function SetTable({ sets }: SetTableProps) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Exercise</th>
          <th>Set</th>
          <th>Reps</th>
          <th>kg</th>
          <th>RPE</th>
        </tr>
      </thead>
      <tbody>
        {sets.map((set, i) => (
          <tr key={i}>
            <td>{set.exerciseName}</td>
            <td>{set.setNumber}</td>
            <td>{set.reps ?? '-'}</td>
            <td>{set.weightKg ?? '-'}</td>
            <td>{set.rpe ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
