import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleProxy, type ProxyDeps } from './route';

function req(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('coach proxy route', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let deps: ProxyDeps;

  beforeEach(() => {
    fetchMock = vi.fn();
    deps = {
      getUser: async () => ({ id: 'user-1' }),
      fetch: fetchMock as unknown as typeof fetch,
      env: { JIMBO_API_URL: 'https://jimbo.test', JIMBO_API_KEY: 'secret' },
    };
  });

  it('forwards GET /api/coach/today with X-API-Key attached', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ pending: [] }), { status: 200 }));
    const res = await handleProxy(req('GET', 'http://local/api/coach/today'), ['today'], deps);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('https://jimbo.test/api/coach/today');
    expect((call[1] as RequestInit).headers).toMatchObject({ 'X-API-Key': 'secret' });
  });

  it('forwards POST /api/coach/log with body', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ log_id: 1, remaining_amount: 500 }), { status: 201 }));
    const res = await handleProxy(
      req('POST', 'http://local/api/coach/log', { supplement_id: 'supp_x', dosage: 5, source: 'in_app' }),
      ['log'],
      deps,
    );
    expect(res.status).toBe(201);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toContain('supp_x');
  });

  it('forwards GET /api/coach/supplement/:id', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'supp_x' }), { status: 200 }));
    const res = await handleProxy(req('GET', 'http://local/api/coach/supplement/supp_x'), ['supplement', 'supp_x'], deps);
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe('https://jimbo.test/api/coach/supplement/supp_x');
  });

  it('returns 401 when there is no authenticated user', async () => {
    const unauth = { ...deps, getUser: async () => null };
    const res = await handleProxy(req('GET', 'http://local/api/coach/today'), ['today'], unauth);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 for non-allowlisted admin endpoints (tick)', async () => {
    const res = await handleProxy(req('POST', 'http://local/api/coach/tick'), ['tick'], deps);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 for non-allowlisted inventory endpoint', async () => {
    const res = await handleProxy(req('GET', 'http://local/api/coach/inventory'), ['inventory'], deps);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 for wrong method on allowlisted path', async () => {
    const res = await handleProxy(req('GET', 'http://local/api/coach/log'), ['log'], deps);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 500 when jimbo env is not configured', async () => {
    const missing = { ...deps, env: {} };
    const res = await handleProxy(req('GET', 'http://local/api/coach/today'), ['today'], missing);
    expect(res.status).toBe(500);
  });
});
