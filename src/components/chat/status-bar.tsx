'use client'

import { useUser } from '@/lib/hooks/use-user'
import { useModelConfig } from '@/lib/hooks/use-model-config'
import styles from './status-bar.module.scss'

/** Shorten model IDs for display: "anthropic/claude-haiku-4.5" → "Claude Haiku 4.5" */
function formatModel(modelId: string): string {
  const name = modelId.includes('/') ? modelId.split('/').pop()! : modelId
  return name
    .replace(/^claude-/, 'Claude ')
    .replace(/^gemini-/, 'Gemini ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Claude /, 'Claude ')
    .replace(/Gemini /, 'Gemini ')
}

export function StatusBar() {
  const { user } = useUser()
  const { config, loading: configLoading } = useModelConfig()

  const modelDisplay = configLoading ? '…' : formatModel(config.in_session)

  return (
    <div className={styles.bar}>
      <span className={styles.model} title={config.in_session}>
        {modelDisplay}
      </span>
      {user && (
        <span className={styles.user}>
          {user.email}
        </span>
      )}
    </div>
  )
}
