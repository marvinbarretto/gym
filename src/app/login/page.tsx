'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.scss'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className={styles.container}>
        <p className={styles.confirmation}>Check your email for the login link.</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Gym</h1>
      <form onSubmit={handleLogin} className={styles.form}>
        <input
          type="email"
          className={styles.input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className={styles.button}>Sign in</button>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </div>
  )
}
