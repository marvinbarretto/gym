'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ModelConfig } from '@/lib/ai/model-router'
import { DEFAULT_MODEL_CONFIG } from '@/lib/ai/model-router'
import { useUser } from '@/lib/hooks/use-user'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.scss'

const FIELD_LABELS: Record<keyof ModelConfig, string> = {
  in_session: 'In Session',
  post_session: 'Post Session',
  deep_analysis: 'Deep Analysis',
  fallback: 'Fallback',
}

export default function SettingsPage() {
  const { user } = useUser()
  const router = useRouter()
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => {/* retain defaults */})
  }, [])

  async function handleSave() {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      setStatus(res.ok ? 'saved' : 'error')
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  function handleChange(field: keyof ModelConfig, value: string) {
    setConfig((prev) => ({ ...prev, [field]: value }))
    setStatus('idle')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      {user && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Account</h2>
          <div className={styles.accountRow}>
            <span className={styles.accountEmail}>{user.email}</span>
            <button className={styles.logoutButton} onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Model Routing</h2>
        <div className={styles.fields}>
          {(Object.keys(FIELD_LABELS) as Array<keyof ModelConfig>).map((field) => (
            <div key={field} className={styles.field}>
              <label htmlFor={field} className={styles.label}>
                {FIELD_LABELS[field]}
              </label>
              <input
                id={field}
                type="text"
                className={styles.input}
                value={config[field]}
                onChange={(e) => handleChange(field, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {status === 'saved' && <span className={styles.statusSaved}>Saved</span>}
          {status === 'error' && <span className={styles.statusError}>Error saving</span>}
        </div>
      </section>
    </main>
  )
}
