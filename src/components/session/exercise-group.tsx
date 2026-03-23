'use client'

import { useState } from 'react'
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
  onRefetch?: () => void
}

export function ExerciseGroup({ name, sets, onRefetch }: ExerciseGroupProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ reps: string; weight_kg: string; rpe: string }>({ reps: '', weight_kg: '', rpe: '' })

  function startEdit(set: SetRow) {
    setEditingId(set.id)
    setEditValues({
      reps: set.reps?.toString() ?? '',
      weight_kg: set.weight_kg?.toString() ?? '',
      rpe: set.rpe?.toString() ?? '',
    })
  }

  async function saveEdit(setId: string) {
    const body: Record<string, number | null> = {}
    const reps = editValues.reps.trim()
    const weight = editValues.weight_kg.trim()
    const rpe = editValues.rpe.trim()

    body.reps = reps ? parseInt(reps, 10) : null
    body.weightKg = weight ? parseFloat(weight) : null
    body.rpe = rpe ? parseInt(rpe, 10) : null

    await fetch(`/api/sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditingId(null)
    onRefetch?.()
  }

  async function handleDelete(setId: string) {
    await fetch(`/api/sets/${setId}`, { method: 'DELETE' })
    setEditingId(null)
    onRefetch?.()
  }

  function handleKeyDown(e: React.KeyboardEvent, setId: string) {
    if (e.key === 'Enter') saveEdit(setId)
    if (e.key === 'Escape') setEditingId(null)
  }

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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sets.map(set => (
            <tr key={set.id}>
              <td>{set.set_number}</td>
              {editingId === set.id ? (
                <>
                  <td>
                    <input
                      className={styles.editInput}
                      value={editValues.reps}
                      onChange={e => setEditValues(v => ({ ...v, reps: e.target.value }))}
                      onKeyDown={e => handleKeyDown(e, set.id)}
                      onBlur={() => saveEdit(set.id)}
                      autoFocus
                      inputMode="numeric"
                    />
                  </td>
                  <td>
                    <input
                      className={styles.editInput}
                      value={editValues.weight_kg}
                      onChange={e => setEditValues(v => ({ ...v, weight_kg: e.target.value }))}
                      onKeyDown={e => handleKeyDown(e, set.id)}
                      onBlur={() => saveEdit(set.id)}
                      inputMode="decimal"
                    />
                  </td>
                  <td>
                    <input
                      className={styles.editInput}
                      value={editValues.rpe}
                      onChange={e => setEditValues(v => ({ ...v, rpe: e.target.value }))}
                      onKeyDown={e => handleKeyDown(e, set.id)}
                      onBlur={() => saveEdit(set.id)}
                      inputMode="numeric"
                    />
                  </td>
                  <td>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(set.id)}>×</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{set.reps ?? '—'}</td>
                  <td>{set.weight_kg ?? '—'}</td>
                  <td>{set.rpe ?? '—'}</td>
                  <td>
                    <button className={styles.editBtn} onClick={() => startEdit(set)}>✎</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
