// src/lib/ai/exercise-resolver.test.ts
import { describe, it, expect } from 'vitest'
import { resolveExercise } from './exercise-resolver'

const EXERCISES = [
  { id: 'uuid-1', name: 'Chest Press Machine' },
  { id: 'uuid-2', name: 'Treadmill Run' },
  { id: 'uuid-3', name: 'Lat Pulldown' },
  { id: 'uuid-4', name: 'Seated Cable Row' },
  { id: 'uuid-5', name: 'Dumbbell Shoulder Press' },
  { id: 'uuid-6', name: 'Pec Deck' },
]

describe('resolveExercise', () => {
  it('exact match (case-insensitive)', () => {
    const result = resolveExercise('chest press machine', EXERCISES)
    expect(result).toEqual({ match: 'exact', exercise: EXERCISES[0] })
  })

  it('partial match — "chest press" matches "Chest Press Machine"', () => {
    const result = resolveExercise('chest press', EXERCISES)
    expect(result).toEqual({ match: 'fuzzy', exercise: EXERCISES[0] })
  })

  it('partial match — "treadmill" matches "Treadmill Run"', () => {
    const result = resolveExercise('treadmill', EXERCISES)
    expect(result).toEqual({ match: 'fuzzy', exercise: EXERCISES[1] })
  })

  it('ambiguous — "press" matches multiple exercises', () => {
    const result = resolveExercise('press', EXERCISES)
    expect(result.match).toBe('ambiguous')
    expect(result.candidates!.length).toBeGreaterThan(1)
  })

  it('no match', () => {
    const result = resolveExercise('swimming', EXERCISES)
    expect(result).toEqual({ match: 'none' })
  })

  it('handles canonical name from AI exactly', () => {
    const result = resolveExercise('Lat Pulldown', EXERCISES)
    expect(result).toEqual({ match: 'exact', exercise: EXERCISES[2] })
  })
})
