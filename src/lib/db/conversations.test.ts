import { describe, it, expect } from 'vitest'
import { buildCreateConversation, buildAddMessage } from './conversations'

describe('conversations', () => {
  it('buildCreateConversation returns correct insert shape', () => {
    const result = buildCreateConversation({
      userId: 'user-1',
      type: 'session',
      sessionId: 'session-1',
    })
    expect(result.user_id).toBe('user-1')
    expect(result.type).toBe('session')
    expect(result.session_id).toBe('session-1')
  })

  it('buildCreateConversation defaults sessionId to null for free chat', () => {
    const result = buildCreateConversation({
      userId: 'user-1',
      type: 'question',
    })
    expect(result.session_id).toBeNull()
  })

  it('buildAddMessage returns correct insert shape', () => {
    const result = buildAddMessage({
      conversationId: 'conv-1',
      role: 'user',
      content: 'hello',
    })
    expect(result.conversation_id).toBe('conv-1')
    expect(result.role).toBe('user')
    expect(result.content).toBe('hello')
    expect(result.tool_calls).toBeNull()
  })

  it('buildAddMessage includes tool_calls when provided', () => {
    const toolCalls = [{ toolName: 'log_set', args: { reps: 10 } }]
    const result = buildAddMessage({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Logged.',
      toolCalls,
    })
    expect(result.tool_calls).toEqual(toolCalls)
  })
})
