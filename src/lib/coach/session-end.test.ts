import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn()
globalThis.fetch = fetchMock as unknown as typeof fetch

const { notifyCoachSessionEnd } = await import('./session-end')

describe('notifyCoachSessionEnd', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('POSTs session_id and ended_at to /api/coach/session-end', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }))
    await notifyCoachSessionEnd({ sessionId: 'sess-1', endedAt: '2026-04-19T13:00:00Z' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/coach/session-end')
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      session_id: 'sess-1',
      ended_at: '2026-04-19T13:00:00Z',
    })
  })

  it('swallows errors so session-end never fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'))
    await expect(notifyCoachSessionEnd({ sessionId: 's', endedAt: 'x' })).resolves.toBeUndefined()
  })
})
