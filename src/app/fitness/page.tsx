import styles from './page.module.scss'

// TODO: This is a proof-of-concept. Next steps:
// - Decide how to use this data (dashboard? trends? correlate with gym sessions?)
// - Move fetch logic to src/lib/db/ or a dedicated fitness module
// - Add date range picker
// - Store in Supabase instead of fetching live from Jimbo each time

interface ExerciseSession {
  type: string
  duration_min: number
  start_time: string
}

interface DailySummary {
  date: string
  steps: number
  distance_m: number
  calories_active: number
  calories_total: number
  floors: number
  exercise_sessions: ExerciseSession[]
}

interface FitnessSummary {
  days: number
  daily: DailySummary[]
  totals: {
    steps: number
    distance_m: number
    exercise_sessions: number
  }
}

async function fetchSummary(days = 7): Promise<FitnessSummary | null> {
  const url = process.env.JIMBO_API_URL
  const key = process.env.JIMBO_API_KEY

  if (!url || !key) return null

  const res = await fetch(`${url}/api/fitness/summary?days=${days}`, {
    headers: { 'X-API-Key': key },
    next: { revalidate: 300 },
  })

  if (!res.ok) return null
  return res.json()
}

function formatDistance(metres: number): string {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres)} m`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = today.getTime() - d.getTime()
  const daysDiff = Math.floor(diff / 86400000)

  if (daysDiff === 0) return 'Today'
  if (daysDiff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default async function FitnessPage() {
  const summary = await fetchSummary(7)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Fitness</h1>
      <p className={styles.subtitle}>
        Last 7 days from Health Connect via Jimbo
      </p>

      {!summary || summary.daily.length === 0 ? (
        <p className={styles.empty}>
          No fitness data available. Check JIMBO_API_URL and JIMBO_API_KEY env vars.
        </p>
      ) : (
        <>
          <div className={styles.totals}>
            <div className={styles.totalCard}>
              <span className={styles.totalValue}>
                {summary.totals.steps.toLocaleString()}
              </span>
              <span className={styles.totalLabel}>steps</span>
            </div>
            <div className={styles.totalCard}>
              <span className={styles.totalValue}>
                {formatDistance(summary.totals.distance_m)}
              </span>
              <span className={styles.totalLabel}>distance</span>
            </div>
            <div className={styles.totalCard}>
              <span className={styles.totalValue}>
                {summary.totals.exercise_sessions}
              </span>
              <span className={styles.totalLabel}>workouts</span>
            </div>
          </div>

          <div className={styles.days}>
            {summary.daily.map((day) => (
              <div key={day.date} className={styles.dayCard}>
                <div className={styles.dayHeader}>
                  <span className={styles.dayDate}>{formatDate(day.date)}</span>
                  <span className={styles.daySteps}>
                    {day.steps.toLocaleString()} steps
                  </span>
                </div>
                <div className={styles.dayStats}>
                  <span>{formatDistance(day.distance_m)}</span>
                  <span>{Math.round(day.calories_active)} kcal</span>
                  {day.floors > 0 && <span>{Math.round(day.floors)} floors</span>}
                </div>
                {day.exercise_sessions.length > 0 && (
                  <div className={styles.exercises}>
                    {day.exercise_sessions.map((ex, i) => (
                      <span key={i} className={styles.exercise}>
                        {ex.type} &middot; {Math.round(ex.duration_min)} min
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
