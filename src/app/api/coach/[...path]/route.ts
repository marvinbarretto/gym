// src/app/api/coach/[...path]/route.ts
// Proxy to jimbo-api. Attaches X-API-Key server-side so it never leaks to browser.
// Allowlisted paths only — admin endpoints (tick, inventory) are not exposed through the PWA.
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ path: string[] }> }

type AllowedRoute = { method: 'GET' | 'POST'; match: (path: string[]) => boolean }

const ALLOWLIST: AllowedRoute[] = [
  { method: 'GET', match: (p) => p.length === 1 && p[0] === 'today' },
  { method: 'POST', match: (p) => p.length === 1 && p[0] === 'log' },
  { method: 'POST', match: (p) => p.length === 1 && p[0] === 'skip' },
  { method: 'POST', match: (p) => p.length === 1 && p[0] === 'later' },
  { method: 'POST', match: (p) => p.length === 1 && p[0] === 'session-end' },
  { method: 'GET', match: (p) => p.length === 2 && p[0] === 'supplement' },
]

function isAllowed(method: string, path: string[]): boolean {
  return ALLOWLIST.some((r) => r.method === method && r.match(path))
}

export interface ProxyDeps {
  getUser: () => Promise<{ id: string } | null>
  fetch: typeof fetch
  env: { JIMBO_API_URL?: string; JIMBO_API_KEY?: string }
}

export async function handleProxy(req: Request, path: string[], deps: ProxyDeps): Promise<Response> {
  if (!isAllowed(req.method, path)) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })
  }

  const user = await deps.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
  }

  const { JIMBO_API_URL: base, JIMBO_API_KEY: key } = deps.env
  if (!base || !key) {
    return new Response(JSON.stringify({ error: 'jimbo_api_not_configured' }), { status: 500 })
  }

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

  const upstream = await deps.fetch(targetUrl, init)
  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}

async function defaultDeps(): Promise<ProxyDeps> {
  const supabase = await createClient()
  return {
    getUser: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user ? { id: data.user.id } : null
    },
    fetch,
    env: {
      JIMBO_API_URL: process.env.JIMBO_API_URL,
      JIMBO_API_KEY: process.env.JIMBO_API_KEY,
    },
  }
}

async function proxy(req: Request, params: Params['params']): Promise<Response> {
  const { path } = await params
  return handleProxy(req, path, await defaultDeps())
}

export async function GET(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
export async function POST(req: NextRequest, ctx: Params) { return proxy(req, ctx.params) }
