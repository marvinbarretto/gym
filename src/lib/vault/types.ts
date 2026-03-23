export interface VaultSessionSummary {
  type: 'gym_session'
  date: string
  duration_min: number
  exercises: string[]
  total_sets: number
  summary: string
  tags: string[]
}

export interface VaultCheckIn {
  type: 'gym_check_in'
  date: string
  soreness: Record<string, number>
  energy: number | null
  notes: string | null
  tags: string[]
}

export interface VaultMilestone {
  type: 'gym_milestone'
  date: string
  kind: 'first_session' | 'new_pr' | 'streak'
  description: string
  tags: string[]
}

export type VaultEvent = VaultSessionSummary | VaultCheckIn | VaultMilestone
