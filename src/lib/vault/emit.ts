import type { VaultEvent } from './types'

const VAULT_API_URL = process.env.JIMBO_VAULT_URL

export async function emitToVault(event: VaultEvent): Promise<void> {
  if (!VAULT_API_URL) {
    console.log('[vault] no JIMBO_VAULT_URL configured, skipping emit:', event.type)
    return
  }

  try {
    const res = await fetch(VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    if (!res.ok) {
      console.error('[vault] emit failed:', res.status, await res.text())
    } else {
      console.log('[vault] emitted:', event.type)
    }
  } catch (err) {
    console.error('[vault] emit error (non-blocking):', err)
  }
}
