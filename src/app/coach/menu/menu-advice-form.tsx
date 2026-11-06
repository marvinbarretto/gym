'use client'
import { useState, useTransition } from 'react'
import styles from './page.module.scss'

interface MenuAdvice {
  item: string
  rationale: string
  default_used: boolean
}

export function MenuAdviceForm() {
  const [menu, setMenu] = useState('')
  const [advice, setAdvice] = useState<MenuAdvice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/coach/menu-advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menu }),
        })
        if (!res.ok) throw new Error(`menu-advice ${res.status}`)
        setAdvice(await res.json())
      } catch (err) {
        setAdvice(null)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={submit}>
      <textarea
        className={styles.menu}
        value={menu}
        onChange={(e) => setMenu(e.target.value)}
        rows={10}
        placeholder="Grilled chicken salad&#10;Beer-battered fish and chips"
        aria-label="Menu"
      />
      <button className={styles.submit} type="submit" disabled={pending || menu.trim() === ''}>
        {pending ? 'Thinking…' : 'What should I have?'}
      </button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {advice && (
        <section className={styles.result} aria-live="polite">
          <h2 className={styles.item}>{advice.item}</h2>
          <p>{advice.rationale}</p>
        </section>
      )}
    </form>
  )
}
