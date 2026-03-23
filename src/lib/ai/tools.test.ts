import { describe, it, expect } from 'vitest'
import { createGymTools } from './tools'

describe('gym tools', () => {
  const stubSupabase = {} as any
  const tools = createGymTools(stubSupabase, 'test-user-id')

  it('defines all required tools', () => {
    const expectedTools = [
      'start_session', 'log_set', 'log_cardio', 'end_session',
      'get_todays_plan', 'get_exercise_history', 'search_exercises',
      'get_equipment', 'add_equipment',
    ]
    const toolNames = Object.keys(tools)
    for (const name of expectedTools) {
      expect(toolNames).toContain(name)
    }
  })

  it('each tool has description and execute', () => {
    for (const [name, t] of Object.entries(tools)) {
      expect(t, `${name} missing description`).toHaveProperty('description')
      expect(t, `${name} missing execute`).toHaveProperty('execute')
    }
  })

  it('defines exactly 9 tools', () => {
    expect(Object.keys(tools)).toHaveLength(9)
  })
})
