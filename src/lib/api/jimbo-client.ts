// Server-only HTTP client for jimbo-api.
// Authenticates with X-API-Key. Single source for every /api/gym/* call.
// Replaces the previous Supabase data layer (src/lib/db/*).

import 'server-only'

const BASE_URL = process.env.JIMBO_API_URL
const API_KEY = process.env.JIMBO_API_KEY

function requireEnv() {
  if (!BASE_URL || !API_KEY) {
    throw new Error('JIMBO_API_URL and JIMBO_API_KEY must be set')
  }
  return { base: BASE_URL, key: API_KEY }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const { base, key } = requireEnv()
  const res = await fetch(`${base}/api/gym${path}`, {
    method,
    headers: {
      'X-API-Key': key,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  if (res.status === 204) {
    return undefined as T
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`jimbo-api ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Types (mirror jimbo-api response shapes) ─────────────────────

export interface MuscleGroup { id: number; name: string }

export interface Exercise {
  id: string
  source: 'system' | 'user'
  name: string
  primary_muscle_group: number | null
  description: string | null
  movement_type: 'compound' | 'isolation' | null
  equipment_type: 'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio' | null
  secondary_muscle_groups: number[]
  created_at: string
}

export interface UserGym {
  id: string
  name: string
  location: string | null
  notes: string | null
  created_at: string
}

export interface Equipment {
  id: string
  gym_id: string
  name: string
  type: 'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio'
  description: string | null
  photo_url: string | null
  created_at: string
}

export interface Profile {
  id: 'me'
  display_name: string | null
  height_cm: number | null
  weight_kg: number | null
  date_of_birth: string | null
  fitness_goal: string | null
  experience_level: 'beginner' | 'intermediate' | 'advanced' | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  started_at: string
  ended_at: string | null
  pre_energy: number | null
  notes: string | null
  vault_note_id: string | null
  created_at: string
}

export interface SessionSet {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  duration_s: number | null
  notes: string | null
  created_at: string
}

export interface SessionCardio {
  id: string
  session_id: string
  exercise_id: string
  duration_s: number | null
  distance_km: number | null
  avg_heart_rate: number | null
  notes: string | null
  created_at: string
}

export interface SessionDetail extends Session {
  sets: SessionSet[]
  cardio: SessionCardio[]
}

// ── Reference data ────────────────────────────────────────────────

export const muscleGroups = {
  list: () => request<MuscleGroup[]>('GET', '/muscle-groups'),
}

export const exercises = {
  search: (opts: { q?: string; muscle_group?: number; limit?: number } = {}) => {
    const params = new URLSearchParams()
    if (opts.q) params.set('q', opts.q)
    if (opts.muscle_group != null) params.set('muscle_group', String(opts.muscle_group))
    if (opts.limit != null) params.set('limit', String(opts.limit))
    const qs = params.toString()
    return request<Exercise[]>('GET', `/exercises${qs ? '?' + qs : ''}`)
  },
  get: (id: string) => request<Exercise>('GET', `/exercises/${id}`),
  create: (data: {
    name: string
    primary_muscle_group?: number
    description?: string
    movement_type?: 'compound' | 'isolation'
    equipment_type?: 'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio'
    secondary_muscle_groups?: number[]
  }) => request<Exercise>('POST', '/exercises', { secondary_muscle_groups: [], ...data }),
}

// ── Gyms & equipment ──────────────────────────────────────────────

export const gyms = {
  list: () => request<UserGym[]>('GET', '/gyms'),
  create: (data: { name: string; location?: string; notes?: string }) =>
    request<UserGym>('POST', '/gyms', data),
  equipment: (gymId: string) => request<Equipment[]>('GET', `/gyms/${gymId}/equipment`),
}

export const equipment = {
  create: (data: {
    gym_id: string
    name: string
    type: Equipment['type']
    description?: string
    photo_url?: string
  }) => request<Equipment>('POST', '/equipment', data),
}

// ── Profile ───────────────────────────────────────────────────────

export const profile = {
  get: () => request<Profile>('GET', '/profile'),
  update: (patch: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) =>
    request<Profile>('PATCH', '/profile', patch),
}

// ── Sessions ──────────────────────────────────────────────────────

export const sessions = {
  create: (data: { pre_energy?: number; notes?: string } = {}) =>
    request<Session>('POST', '/sessions', data),
  list: (opts: { limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams()
    if (opts.limit != null) params.set('limit', String(opts.limit))
    if (opts.offset != null) params.set('offset', String(opts.offset))
    const qs = params.toString()
    return request<Session[]>('GET', `/sessions${qs ? '?' + qs : ''}`)
  },
  active: () => request<Session | null>('GET', '/sessions/active'),
  detail: (id: string) => request<SessionDetail>('GET', `/sessions/${id}`),
  update: (id: string, patch: {
    ended_at?: string | null
    pre_energy?: number | null
    notes?: string | null
    vault_note_id?: string | null
  }) => request<Session>('PATCH', `/sessions/${id}`, patch),
  end: (id: string, notes?: string) =>
    request<Session>('PATCH', `/sessions/${id}`, {
      ended_at: new Date().toISOString(),
      ...(notes !== undefined ? { notes } : {}),
    }),
}

// ── Sets & cardio ─────────────────────────────────────────────────

export const sets = {
  create: (sessionId: string, data: {
    exercise_id: string
    set_number: number
    reps?: number
    weight_kg?: number
    rpe?: number
    duration_s?: number
    notes?: string
  }) => request<SessionSet>('POST', `/sessions/${sessionId}/sets`, data),
  update: (setId: string, patch: {
    exercise_id?: string
    set_number?: number
    reps?: number | null
    weight_kg?: number | null
    rpe?: number | null
    duration_s?: number | null
    notes?: string | null
  }) => request<SessionSet>('PATCH', `/sets/${setId}`, patch),
  delete: (setId: string) => request<void>('DELETE', `/sets/${setId}`),
}

export const cardio = {
  create: (sessionId: string, data: {
    exercise_id: string
    duration_s?: number
    distance_km?: number
    avg_heart_rate?: number
    notes?: string
  }) => request<SessionCardio>('POST', `/sessions/${sessionId}/cardio`, data),
  update: (cardioId: string, patch: {
    exercise_id?: string
    duration_s?: number | null
    distance_km?: number | null
    avg_heart_rate?: number | null
    notes?: string | null
  }) => request<SessionCardio>('PATCH', `/cardio/${cardioId}`, patch),
  delete: (cardioId: string) => request<void>('DELETE', `/cardio/${cardioId}`),
}
