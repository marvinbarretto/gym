'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from '@/lib/ai/model-router'

export function useModelConfig() {
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => {
        if (res.status === 401) {
          console.warn('[use-model-config] Not authenticated — using default config')
          return null
        }
        if (!res.ok) {
          console.error(`[use-model-config] Failed to load settings: ${res.status} ${res.statusText}`)
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data) setConfig(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('[use-model-config] Network error loading settings:', err)
        setLoading(false)
      })
  }, [])

  return { config, loading }
}
