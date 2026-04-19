// src/lib/coach/session-end.ts
// Fire-and-forget notifier. Must never throw — session-end is the primary op.

export async function notifyCoachSessionEnd(opts: { sessionId: string; endedAt: string }): Promise<void> {
  try {
    await fetch('/api/coach/session-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: opts.sessionId, ended_at: opts.endedAt }),
    })
  } catch {
    // ignore
  }
}
