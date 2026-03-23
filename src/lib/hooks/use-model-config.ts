'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from '@/lib/ai/model-router'

export function useModelConfig() {
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setConfig(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { config, loading }
}
