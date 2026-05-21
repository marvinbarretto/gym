import { NextResponse } from 'next/server'
import { sessions } from '@/lib/api/jimbo-client'

export async function GET() {
  try {
    const session = await sessions.active()
    return NextResponse.json({ session })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await sessions.create({})
    return NextResponse.json({ session })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { action, sessionId } = await request.json()
  if (action === 'end' && sessionId) {
    try {
      const session = await sessions.end(sessionId)
      return NextResponse.json({ session })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
