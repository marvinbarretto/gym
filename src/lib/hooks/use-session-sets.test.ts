import { describe, it, expect } from 'vitest'
import { groupSetsByExercise } from './use-session-sets'

describe('groupSetsByExercise', () => {
  it('groups sets by exercise_id preserving log order', () => {
    const sets = [
      { id: '1', exercise_id: 'ex-a', set_number: 1, reps: 10, weight_kg: 25, rpe: 5, duration_s: null, notes: null, exercises: { name: 'Chest Press' } },
      { id: '2', exercise_id: 'ex-a', set_number: 2, reps: 10, weight_kg: 25, rpe: 8, duration_s: null, notes: null, exercises: { name: 'Chest Press' } },
      { id: '3', exercise_id: 'ex-b', set_number: 1, reps: 5, weight_kg: 15, rpe: 5, duration_s: null, notes: null, exercises: { name: 'Shoulder Press' } },
    ]
    const groups = groupSetsByExercise(sets)
    expect(groups).toHaveLength(2)
    expect(groups[0].exerciseName).toBe('Chest Press')
    expect(groups[0].sets).toHaveLength(2)
    expect(groups[1].exerciseName).toBe('Shoulder Press')
    expect(groups[1].sets).toHaveLength(1)
  })

  it('returns empty array for no sets', () => {
    expect(groupSetsByExercise([])).toEqual([])
  })
})
