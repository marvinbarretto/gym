import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.stubEnv('JIMBO_API_URL', 'https://jimbo.test');
vi.stubEnv('JIMBO_API_KEY', 'secret');

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  }),
}));

const { GET, POST } = await import('./route');

function req(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

describe('coach proxy route', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('forwards GET /api/coach/today with X-API-Key attached', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ pending: [] }), { status: 200 }));
    const res = await GET(req('GET', 'http://local/api/coach/today'), { params: Promise.resolve({ path: ['today'] }) });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('https://jimbo.test/api/coach/today');
    expect((call[1] as RequestInit).headers).toMatchObject({ 'X-API-Key': 'secret' });
  });

  it('forwards POST /api/coach/log with body', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ log_id: 1, remaining_amount: 500 }), { status: 201 }));
    const res = await POST(req('POST', 'http://local/api/coach/log', { supplement_id: 'supp_x', dosage: 5, source: 'in_app' }), { params: Promise.resolve({ path: ['log'] }) });
    expect(res.status).toBe(201);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toContain('supp_x');
  });

  it('returns 401 when there is no authenticated user', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }),
    }));
    vi.resetModules();
    const { GET: GetFresh } = await import('./route');
    const res = await GetFresh(req('GET', 'http://local/api/coach/today'), { params: Promise.resolve({ path: ['today'] }) });
    expect(res.status).toBe(401);
  });
});
