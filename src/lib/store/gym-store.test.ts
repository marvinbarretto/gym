// src/lib/store/gym-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createGymStore, type GymState } from './gym-store'

let store: ReturnType<typeof createGymStore>

beforeEach(() => {
  store = createGymStore()
})

describe('session', () => {
  it('starts with no session', () => {
    expect(store.getState().session).toBeNull()
  })

  it('sets session', () => {
    store.getState().setSession({ id: 's1', started_at: '2026-04-13T10:00:00Z' })
    expect(store.getState().session).toEqual({ id: 's1', started_at: '2026-04-13T10:00:00Z' })
  })

  it('clears session and resets exercises', () => {
    store.getState().setSession({ id: 's1', started_at: '2026-04-13T10:00:00Z' })
    store.getState().addSets([{ id: 'set1', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 1, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null }])
    expect(store.getState().sets).toHaveLength(1)

    store.getState().clearSession()
    expect(store.getState().session).toBeNull()
    expect(store.getState().sets).toHaveLength(0)
    expect(store.getState().cardio).toHaveLength(0)
  })
})

describe('sets', () => {
  it('adds sets', () => {
    store.getState().addSets([
      { id: 'set1', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 1, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
      { id: 'set2', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 2, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
    ])
    expect(store.getState().sets).toHaveLength(2)
  })

  it('removes sets by IDs (undo)', () => {
    store.getState().addSets([
      { id: 'set1', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 1, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
      { id: 'set2', session_id: 's1', exercise_id: 'e1', exercise_name: 'Bench', set_number: 2, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
    ])
    store.getState().removeSets(['set1'])
    expect(store.getState().sets).toHaveLength(1)
    expect(store.getState().sets[0].id).toBe('set2')
  })
})

describe('cardio', () => {
  it('adds cardio entry', () => {
    store.getState().addCardio({ id: 'c1', session_id: 's1', exercise_id: 'e2', exercise_name: 'Treadmill', duration_s: 1800, distance_km: 5, avg_heart_rate: null, notes: null })
    expect(store.getState().cardio).toHaveLength(1)
  })

  it('removes cardio entry (undo)', () => {
    store.getState().addCardio({ id: 'c1', session_id: 's1', exercise_id: 'e2', exercise_name: 'Treadmill', duration_s: 1800, distance_km: 5, avg_heart_rate: null, notes: null })
    store.getState().removeCardio('c1')
    expect(store.getState().cardio).toHaveLength(0)
  })
})

describe('exercise groups', () => {
  it('groups sets by exercise', () => {
    store.getState().addSets([
      { id: 's1', session_id: 'x', exercise_id: 'e1', exercise_name: 'Bench', set_number: 1, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
      { id: 's2', session_id: 'x', exercise_id: 'e1', exercise_name: 'Bench', set_number: 2, reps: 10, weight_kg: 40, rpe: null, duration_s: null, notes: null },
      { id: 's3', session_id: 'x', exercise_id: 'e2', exercise_name: 'Squat', set_number: 1, reps: 8, weight_kg: 60, rpe: null, duration_s: null, notes: null },
    ])
    const groups = store.getState().exerciseGroups()
    expect(groups).toHaveLength(2)
    expect(groups[0].exerciseName).toBe('Bench')
    expect(groups[0].sets).toHaveLength(2)
    expect(groups[1].exerciseName).toBe('Squat')
    expect(groups[1].sets).toHaveLength(1)
  })
})
