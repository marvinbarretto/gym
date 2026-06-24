import { cookies } from 'next/headers'
import {
  CoachTodayClient,
  type CoachToday,
  type ProtocolItem,
  type InventoryItem,
  type SupplementLogEntry,
} from './coach-today-client'
import styles from './page.module.scss'

export const dynamic = 'force-dynamic'

async function getJson<T>(path: string, cookieHeader: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}${path}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return fallback
    return res.json()
  } catch {
    return fallback
  }
}

export default async function CoachTodayPage() {
  const cookieHeader = (await cookies()).toString()

  // today is the spine — if it fails the page has nothing to show, so let it
  // throw. The overview reads degrade to empty rather than break the page.
  const todayRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/coach/today`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })
  if (!todayRes.ok) throw new Error(`coach/today ${todayRes.status}`)
  const today: CoachToday = await todayRes.json()

  const [protocol, inventory, history] = await Promise.all([
    getJson<{ items: ProtocolItem[] }>('/api/coach/protocol', cookieHeader, { items: [] }),
    getJson<{ items: InventoryItem[] }>('/api/coach/inventory', cookieHeader, { items: [] }),
    getJson<{ items: SupplementLogEntry[] }>('/api/coach/supplement-log', cookieHeader, { items: [] }),
  ])

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Today&rsquo;s stack</h1>
      <p className={styles.date}>{today.date}</p>
      <CoachTodayClient
        initial={today}
        protocol={protocol.items}
        inventory={inventory.items}
        history={history.items}
      />
    </main>
  )
}
