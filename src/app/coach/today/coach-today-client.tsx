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

export interface ProtocolItem {
  id: string
  name: string
  dose_amount: number
  dose_unit: string
  timing_tags: string[]
  rationale_short: string
}

export interface InventoryItem {
  supplement_id: string
  name: string
  remaining_amount: number | null
  dose_unit: string
  projected_days_left: number | null
  reorder_soon: boolean
}

export interface SupplementLogEntry {
  id: number
  taken_at: string
  supplement_id: string
  name: string
  dosage: number
  dose_unit: string
  source: string
}

const ANCHOR_LABELS: Record<string, string> = {
  morning: 'Morning',
  post_workout: 'Post-workout',
  rest_day_fallback: 'Daily (rest day)',
  bedtime: 'Bedtime',
  loading: 'Creatine loading',
}

// Display order for timing anchors — earliest in the day first. Used to sort
// the protocol list and to order each item's moment chips.
const ANCHOR_RANK: Record<string, number> = {
  morning: 0,
  loading: 1,
  post_workout: 2,
  rest_day_fallback: 3,
  bedtime: 4,
}

function anchorRank(tag: string): number {
  return ANCHOR_RANK[tag] ?? 99
}

async function postAction(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

function formatDose(amount: number, unit: string): string {
  return unit ? `${amount}${unit}` : `${amount}`
}

export function CoachTodayClient({
  initial,
  protocol,
  inventory: initialInventory,
  history: initialHistory,
}: {
  initial: CoachToday
  protocol: ProtocolItem[]
  inventory: InventoryItem[]
  history: SupplementLogEntry[]
}) {
  const [data, setData] = useState(initial)
  const [inventory, setInventory] = useState(initialInventory)
  const [history, setHistory] = useState(initialHistory)
  const [, startTransition] = useTransition()

  async function refresh() {
    const [today, inv, hist] = await Promise.all([
      fetch('/api/coach/today', { cache: 'no-store' }),
      fetch('/api/coach/inventory', { cache: 'no-store' }),
      fetch('/api/coach/supplement-log', { cache: 'no-store' }),
    ])
    if (today.ok) setData(await today.json())
    if (inv.ok) setInventory((await inv.json()).items ?? [])
    if (hist.ok) setHistory((await hist.json()).items ?? [])
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

  // Show the protocol exactly as the coach encodes it — every active
  // supplement, ordered by its earliest moment in the day. No hardcoded "daily
  // set": whey and creatine share the same anchors, so any heuristic that split
  // them would drift from the real schedule.
  const protocolSorted = [...protocol].sort((a, b) => {
    const ra = Math.min(...a.timing_tags.map(anchorRank), 99)
    const rb = Math.min(...b.timing_tags.map(anchorRank), 99)
    return ra - rb
  })

  return (
    <div>
      <Section title="Pending" nudges={data.pending} onTaken={logAll} onSkip={skip} onLater={later} />
      <Section title="Logged" nudges={data.logged} readOnly />
      <Section title="Skipped" nudges={data.skipped} readOnly />

      <Protocol items={protocolSorted} />
      <Inventory items={inventory} />
      <History entries={history} />
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

function momentLabel(tags: string[]): string {
  return [...tags]
    .sort((a, b) => anchorRank(a) - anchorRank(b))
    .map(t => ANCHOR_LABELS[t] ?? t)
    .join(' · ')
}

function Protocol({ items }: { items: ProtocolItem[] }) {
  if (items.length === 0) return null
  return (
    <section className={styles.section}>
      <h2>Your protocol</h2>
      <p className={styles.rationale}>Everything active, and when the coach prompts it.</p>
      <ul>
        {items.map(p => (
          <li key={p.id}>
            <a href={`/coach/supplement/${p.id}`}><strong>{p.name}</strong></a>{' '}
            — {formatDose(p.dose_amount, p.dose_unit)} · {momentLabel(p.timing_tags)}
            <div className={styles.rationale}>{p.rationale_short}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Inventory({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) return null
  return (
    <section className={styles.section}>
      <h2>Inventory</h2>
      <ul>
        {items.map(i => (
          <li key={i.supplement_id}>
            <strong>{i.name}</strong>
            {i.remaining_amount !== null && <> — {formatDose(i.remaining_amount, i.dose_unit)} left</>}
            {i.projected_days_left !== null && <> · ~{i.projected_days_left} days</>}
            {i.reorder_soon && <> · ⚠ reorder soon</>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function History({ entries }: { entries: SupplementLogEntry[] }) {
  if (entries.length === 0) return null
  return (
    <section className={styles.section}>
      <h2>Recent history</h2>
      <ul>
        {entries.map(e => (
          <li key={e.id}>
            <span className={styles.rationale}>
              {new Date(e.taken_at).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>{' '}
            {e.name} — {formatDose(e.dosage, e.dose_unit)}
          </li>
        ))}
      </ul>
    </section>
  )
}
