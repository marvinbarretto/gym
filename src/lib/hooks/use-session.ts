'use client'

import { useState, useEffect, useCallback } from 'react'

interface ActiveSession {
  id: string
  started_at: string
  gym_id: string | null
  user_gyms: { name: string } | null
}

export function useSession() {
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showResumePrompt, setShowResumePrompt] = useState(false)

  useEffect(() => {
    fetch('/api/sessions/active')
      .then(r => {
        if (r.status === 401) {
          console.warn('[use-session] Not authenticated — skipping active session check')
          return { session: null }
        }
        if (!r.ok) {
          console.error(`[use-session] Failed to check active session: ${r.status} ${r.statusText}`)
          return { session: null }
        }
        return r.json()
      })
      .then(({ session }) => {
        if (session) {
          console.info('[use-session] Resumable session found:', session.id)
          setSession(session)
          setShowResumePrompt(true)
        }
      })
      .catch(err => console.error('[use-session] Network error checking active session:', err))
      .finally(() => setLoading(false))
  }, [])

  const startSession = useCallback(async () => {
    const res = await fetch('/api/sessions/active', { method: 'POST' })
    if (res.status === 401) {
      console.warn('[use-session] Not authenticated — cannot start session')
      return null
    }
    if (!res.ok) {
      console.error(`[use-session] Failed to start session: ${res.status} ${res.statusText}`)
      return null
    }
    const { session } = await res.json()
    console.info('[use-session] Session started:', session.id)
    setSession(session)
    setShowResumePrompt(false)
    return session
  }, [])

  const endCurrentSession = useCallback(async () => {
    if (!session) return
    await fetch('/api/sessions/active', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end', sessionId: session.id }),
    })
    setSession(null)
    setShowResumePrompt(false)
  }, [session])

  const resumeSession = useCallback(() => {
    setShowResumePrompt(false)
  }, [])

  const dismissSession = useCallback(async () => {
    await endCurrentSession()
  }, [endCurrentSession])

  return {
    session,
    loading,
    showResumePrompt,
    startSession,
    endCurrentSession,
    resumeSession,
    dismissSession,
    isInSession: !!session && !showResumePrompt,
  }
}
