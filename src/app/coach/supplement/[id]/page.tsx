// src/app/coach/supplement/[id]/page.tsx
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import styles from './page.module.scss'

export const dynamic = 'force-dynamic'

interface Supp {
  id: string
  name: string
  type: string
  dose_amount: number
  dose_unit: string
  rationale_short: string
  rationale_long: string
  remaining_amount: number | null
  loading_started_at: string | null
  loading_daily_dose: number | null
  loading_duration_days: number | null
}

async function fetchSupplement(id: string): Promise<Supp | null> {
  const cookieHeader = (await cookies()).toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/coach/supplement/${id}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`coach/supplement ${res.status}`)
  return res.json()
}

export default async function SupplementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supp = await fetchSupplement(id)
  if (!supp) notFound()

  return (
    <main className={styles.page}>
      <a href="/coach/today" className={styles.back}>&larr; back to today</a>
      <h1>{supp.name}</h1>
      <p className={styles.tagline}>{supp.rationale_short}</p>

      <dl className={styles.facts}>
        <dt>Dose</dt><dd>{supp.dose_amount}{supp.dose_unit}</dd>
        {supp.remaining_amount !== null && (<><dt>Remaining</dt><dd>{supp.remaining_amount}{supp.dose_unit}</dd></>)}
        {supp.loading_started_at && (<><dt>Loading started</dt><dd>{supp.loading_started_at}</dd></>)}
      </dl>

      <article className={styles.body}>
        <ReactMarkdown>{supp.rationale_long}</ReactMarkdown>
      </article>
    </main>
  )
}
