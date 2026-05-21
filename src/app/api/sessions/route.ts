import { NextResponse } from 'next/server'
import { sessions } from '@/lib/api/jimbo-client'

export async function GET() {
  try {
    const list = await sessions.list({ limit: 20 })
    return NextResponse.json(list)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
