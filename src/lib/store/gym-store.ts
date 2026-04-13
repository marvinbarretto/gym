// src/lib/store/gym-store.ts
import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

export interface SessionSet {
  id: string
  session_id: string
  exercise_id: string
  exercise_name: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  duration_s: number | null
  notes: string | null
}

export interface SessionCardio {
  id: string
  session_id: string
  exercise_id: string
  exercise_name: string
  duration_s: number
  distance_km: number | null
  avg_heart_rate: number | null
  notes: string | null
}

export interface Session {
  id: string
  started_at: string
}

export interface ExerciseGroup {
  exerciseId: string
  exerciseName: string
  sets: SessionSet[]
}

export interface GymState {
  session: Session | null
  setSession: (session: Session) => void
  clearSession: () => void

  sets: SessionSet[]
  cardio: SessionCardio[]
  addSets: (sets: SessionSet[]) => void
  removeSets: (ids: string[]) => void
  addCardio: (entry: SessionCardio) => void
  removeCardio: (id: string) => void
  loadSessionData: (sets: SessionSet[], cardio: SessionCardio[]) => void

  exerciseGroups: () => ExerciseGroup[]

  activeModel: string | null
  setActiveModel: (model: string | null) => void
}

export function createGymStore() {
  return createStore<GymState>((set, get) => ({
    session: null,
    setSession: (session) => set({ session }),
    clearSession: () => set({ session: null, sets: [], cardio: [] }),

    sets: [],
    cardio: [],
    addSets: (newSets) => set((state) => ({ sets: [...state.sets, ...newSets] })),
    removeSets: (ids) => set((state) => ({ sets: state.sets.filter(s => !ids.includes(s.id)) })),
    addCardio: (entry) => set((state) => ({ cardio: [...state.cardio, entry] })),
    removeCardio: (id) => set((state) => ({ cardio: state.cardio.filter(c => c.id !== id) })),
    loadSessionData: (sets, cardio) => set({ sets, cardio }),

    exerciseGroups: () => {
      const { sets } = get()
      const groups: ExerciseGroup[] = []
      const seen = new Map<string, ExerciseGroup>()
      const order: string[] = []

      for (const s of sets) {
        if (!seen.has(s.exercise_id)) {
          const group: ExerciseGroup = {
            exerciseId: s.exercise_id,
            exerciseName: s.exercise_name,
            sets: [],
          }
          seen.set(s.exercise_id, group)
          order.push(s.exercise_id)
        }
        seen.get(s.exercise_id)!.sets.push(s)
      }

      for (const key of order) {
        groups.push(seen.get(key)!)
      }
      return groups
    },

    activeModel: null,
    setActiveModel: (model) => set({ activeModel: model }),
  }))
}

// Singleton store for the app
const store = createGymStore()

// React hook — use this in components
export function useGymStore<T>(selector: (state: GymState) => T): T {
  return useStore(store, selector)
}

// Direct access for non-React code
export const gymStore = store
