import { cookies } from 'next/headers'
import { CoachTodayClient, type CoachToday } from './coach-today-client'
import styles from './page.module.scss'

export const dynamic = 'force-dynamic'

async function fetchToday(): Promise<CoachToday> {
  const cookieHeader = (await cookies()).toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/coach/today`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`coach/today ${res.status}`)
  return res.json()
}

export default async function CoachTodayPage() {
  const today = await fetchToday()
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Today&rsquo;s stack</h1>
      <p className={styles.date}>{today.date}</p>
      <CoachTodayClient initial={today} />
    </main>
  )
}
