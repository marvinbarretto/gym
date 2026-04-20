'use client'
import { useState, useTransition } from 'react'
import styles from './page.module.scss'

interface Snap {
  supplement_id: string
  name: string
  dose_amount: number
  dose_unit: string
  rationale_short: string
}

interface Nudge {
  nudge_key: string
  anchor: string
  supplements: Snap[]
  scheduled_for: string
  state: 'pending' | 'logged' | 'skipped' | 'expired'
}

export interface CoachToday {
  date: string
  pending: Nudge[]
  logged: Nudge[]
  skipped: Nudge[]
}

const ANCHOR_LABELS: Record<string, string> = {
  morning: 'Morning',
  post_workout: 'Post-workout',
  rest_day_fallback: 'Daily',
  bedtime: 'Bedtime',
  loading: 'Creatine loading',
}

async function postAction(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

export function CoachTodayClient({ initial }: { initial: CoachToday }) {
  const [data, setData] = useState(initial)
  const [, startTransition] = useTransition()

  async function refresh() {
    const res = await fetch('/api/coach/today', { cache: 'no-store' })
    if (res.ok) setData(await res.json())
  }

  async function logAll(nudge: Nudge) {
    for (const s of nudge.supplements) {
      await postAction('/api/coach/log', {
        supplement_id: s.supplement_id,
        dosage: s.dose_amount,
        source: 'in_app',
        nudge_key: nudge.nudge_key,
      })
    }
    startTransition(refresh)
  }

  async function skip(nudge: Nudge) {
    await postAction('/api/coach/skip', { nudge_key: nudge.nudge_key })
    startTransition(refresh)
  }

  async function later(nudge: Nudge) {
    await postAction('/api/coach/later', { nudge_key: nudge.nudge_key })
    startTransition(refresh)
  }

  return (
    <div>
      <Section title="Pending" nudges={data.pending} onTaken={logAll} onSkip={skip} onLater={later} />
      <Section title="Logged" nudges={data.logged} readOnly />
      <Section title="Skipped" nudges={data.skipped} readOnly />
    </div>
  )
}

function Section({ title, nudges, onTaken, onSkip, onLater, readOnly }: {
  title: string
  nudges: Nudge[]
  onTaken?: (n: Nudge) => void
  onSkip?: (n: Nudge) => void
  onLater?: (n: Nudge) => void
  readOnly?: boolean
}) {
  if (nudges.length === 0) return null
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {nudges.map(n => (
        <article key={n.nudge_key} id={`nudge=${n.nudge_key}`} className={styles.nudge}>
          <h3 className={styles.nudgeTitle}>{ANCHOR_LABELS[n.anchor] ?? n.anchor}</h3>
          <ul>
            {n.supplements.map(s => (
              <li key={s.supplement_id}>
                <a href={`/coach/supplement/${s.supplement_id}`}><strong>{s.name}</strong></a> — {s.dose_amount}{s.dose_unit}
                <div className={styles.rationale}>{s.rationale_short}</div>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <div className={styles.actions}>
              <button onClick={() => onTaken?.(n)}>Taken ✓</button>
              <button onClick={() => onLater?.(n)}>Later (+2h)</button>
              <button onClick={() => onSkip?.(n)}>Skip</button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
