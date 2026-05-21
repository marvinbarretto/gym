import { NextResponse } from 'next/server'
import { sessions } from '@/lib/api/jimbo-client'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await sessions.detail(id)
    return NextResponse.json({ session })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    const status = /\b404\b/.test(msg) ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
