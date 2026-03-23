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
      .then(r => r.json())
      .then(({ session }) => {
        if (session) {
          setSession(session)
          setShowResumePrompt(true)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const startSession = useCallback(async () => {
    const res = await fetch('/api/sessions/active', { method: 'POST' })
    const { session } = await res.json()
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
