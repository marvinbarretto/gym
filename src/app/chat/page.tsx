'use client'

import { useEffect, useState, useCallback } from 'react'
import { V2ChatInterface } from '@/components/v2/chat-interface'
import { V2Tracker } from '@/components/v2/tracker'
import { useGymStore, type SessionSet, type SessionCardio } from '@/lib/store/gym-store'
import styles from './page.module.scss'

export default function V2Page() {
  const session = useGymStore(s => s.session)
  const setSession = useGymStore(s => s.setSession)
  const clearSession = useGymStore(s => s.clearSession)
  const loadSessionData = useGymStore(s => s.loadSessionData)
  const activeModel = useGymStore(s => s.activeModel)
  const [loading, setLoading] = useState(true)
  const [showResume, setShowResume] = useState(false)
  const [pendingSession, setPendingSession] = useState<{ id: string; started_at: string } | null>(null)

  // Check for open session on mount
  useEffect(() => {
    fetch('/api/sessions/active')
      .then(r => r.ok ? r.json() : { session: null })
      .then(({ session: s }) => {
        if (s) {
          setPendingSession(s)
          setShowResume(true)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Load existing sets/cardio when session is set
  useEffect(() => {
    if (!session) return
    fetch(`/api/sessions/${session.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const detail = data?.session ?? data
        if (!detail) return
        const sets: SessionSet[] = (detail.session_sets ?? []).map((s: Record<string, unknown>) => ({
          ...s,
          exercise_name: (s.exercises as Record<string, string> | null)?.name ?? 'Unknown',
        }))
        const cardio: SessionCardio[] = (detail.session_cardio ?? []).map((c: Record<string, unknown>) => ({
          ...c,
          exercise_name: (c.exercises as Record<string, string> | null)?.name ?? 'Unknown',
        }))
        loadSessionData(sets, cardio)
        console.log('[v2] loaded session data:', sets.length, 'sets,', cardio.length, 'cardio')
      })
  }, [session, loadSessionData])

  const handleStart = useCallback(async () => {
    const res = await fetch('/api/sessions/active', { method: 'POST' })
    if (!res.ok) return
    const { session: s } = await res.json()
    setSession(s)
    console.log('[v2] session started:', s.id)
  }, [setSession])

  const handleEnd = useCallback(async () => {
    if (!session) return
    await fetch('/api/sessions/active', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end', sessionId: session.id }),
    })
    clearSession()
    console.log('[v2] session ended')
  }, [session, clearSession])

  const handleResume = useCallback(() => {
    if (pendingSession) {
      setSession(pendingSession)
      setShowResume(false)
    }
  }, [pendingSession, setSession])

  const handleDismiss = useCallback(async () => {
    if (pendingSession) {
      await fetch('/api/sessions/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', sessionId: pendingSession.id }),
      })
    }
    setShowResume(false)
    setPendingSession(null)
  }, [pendingSession])

  if (loading) return null

  return (
    <div className={styles.container}>
      {activeModel && <div className={styles.modelTag}>{activeModel.split('/').pop()}</div>}

      {showResume && pendingSession && (
        <div className={styles.resumePrompt}>
          <p>Open session from {new Date(pendingSession.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          <div className={styles.resumeActions}>
            <button onClick={handleResume}>Resume</button>
            <button onClick={handleDismiss} className={styles.secondary}>Close it</button>
          </div>
        </div>
      )}

      <V2Tracker />

      {session && (
        <div className={styles.sessionActions}>
          <button className={styles.endBtn} onClick={handleEnd}>End Session</button>
        </div>
      )}

      {!session && !showResume && (
        <div className={styles.startContainer}>
          <button className={styles.startBtn} onClick={handleStart}>Start Session</button>
        </div>
      )}

      {session && <V2ChatInterface />}
    </div>
  )
}
