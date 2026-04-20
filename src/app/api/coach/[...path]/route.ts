// src/app/api/coach/[...path]/route.ts
// Proxy to jimbo-api. Attaches X-API-Key server-side so it never leaks to browser.
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ path: string[] }> }

async function proxy(req: Request, params: Params['params']): Promise<Response> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
  }

  const base = process.env.JIMBO_API_URL
  const key = process.env.JIMBO_API_KEY
  if (!base || !key) {
    return new Response(JSON.stringify({ error: 'jimbo_api_not_configured' }), { status: 500 })
  }

  const { path } = await params
  const targetUrl = `${base}/api/coach/${path.join('/')}`

  const init: RequestInit = {
    method: req.method,
    headers: {
      'X-API-Key': key,
      'Content-Type': 'application/json',
    },
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text()
  }

  const upstream = await fetch(targetUrl, init)
  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}

export async function GET(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
export async function POST(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
export async function PATCH(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
export async function DELETE(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
