'use client'

import { useState, useEffect, useCallback } from 'react'

interface SessionSet {
  id: string
  exercise_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  duration_s: number | null
  notes: string | null
  exercises: { name: string } | null
}

export interface ExerciseGroup {
  exerciseId: string
  exerciseName: string
  sets: SessionSet[]
}

export function groupSetsByExercise(sets: SessionSet[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = []
  const seen = new Map<string, ExerciseGroup>()
  const order: string[] = []

  for (const set of sets) {
    const key = set.exercise_id
    if (!seen.has(key)) {
      const group: ExerciseGroup = {
        exerciseId: key,
        exerciseName: set.exercises?.name ?? 'Unknown',
        sets: [],
      }
      seen.set(key, group)
      order.push(key)
    }
    seen.get(key)!.sets.push(set)
  }

  for (const key of order) {
    groups.push(seen.get(key)!)
  }

  return groups
}

export function useSessionSets(sessionId: string | null) {
  const [sets, setSets] = useState<SessionSet[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (res.status === 401) {
        console.warn('[use-session-sets] Not authenticated — cannot load sets')
        return
      }
      if (!res.ok) {
        console.error(`[use-session-sets] Failed to load session sets: ${res.status} ${res.statusText}`)
        return
      }
      const data = await res.json()
      setSets(data?.session_sets ?? [])
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    refetch()
  }, [refetch])

  const groups = groupSetsByExercise(sets)

  return { sets, groups, loading, refetch }
}
