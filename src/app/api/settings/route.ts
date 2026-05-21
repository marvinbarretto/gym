import { NextResponse } from 'next/server'
import { DEFAULT_MODEL_CONFIG } from '@/lib/ai/model-router'

// Settings used to be per-user Supabase rows. Solo system now — return
// the defaults and silently accept writes (no persistence yet).
export function GET() {
  return NextResponse.json(DEFAULT_MODEL_CONFIG)
}

export function PUT() {
  return NextResponse.json({ success: true })
}
