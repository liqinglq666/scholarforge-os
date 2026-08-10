import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as login } from '@/app/api/auth/session/route';
import { POST as signUp } from '@/app/api/auth/sign-up/route';

const PUBLISHABLE_KEY = 'sb_publishable_12345678901234567890';

function headers() {
  return {
    'content-type': 'application/json',
    host: 'scholarforge.example',
    origin: 'https://scholarforge.example',
    'sec-fetch-site': 'same-origin',
    'x-forwarded-host': 'scholarforge.example',
    'x-forwarded-proto': 'https',
  };
}

function request(path: '/api/auth/session' | '/api/auth/sign-up') {
  return new Request(`https://scholarforge.example${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: 'researcher@example.com',
      password: 'correct-password',
    }),
  });
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', PUBLISHABLE_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Supabase auth provider status mapping', () => {
  it('preserves provider throttling and Retry-After for login without reporting bad credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'rate limited' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '75' },
    })));

    const response = await login(request('/api/auth/session'));
    const payload = await response.json() as { error: string; retryAfter?: number };

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('75');
    expect(payload.retryAfter).toBe(75);
    expect(payload.error).toMatch(/过于频繁/);
    expect(payload.error).not.toMatch(/密码不正确/);
  });

  it('maps a login provider outage to 503 instead of a credential error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'provider unavailable' }, { status: 503 })));

    const response = await login(request('/api/auth/session'));
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toMatch(/暂时不可用/);
    expect(payload.error).not.toMatch(/密码不正确/);
  });

  it('preserves provider throttling and Retry-After for signup', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'rate limited' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '120' },
    })));

    const response = await signUp(request('/api/auth/sign-up'));
    const payload = await response.json() as { error: string; retryAfter?: number };

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('120');
    expect(payload.retryAfter).toBe(120);
    expect(payload.error).toMatch(/过于频繁/);
  });

  it('maps a signup provider outage to 503 instead of a registration rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'provider unavailable' }, { status: 500 })));

    const response = await signUp(request('/api/auth/sign-up'));
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toMatch(/暂时不可用/);
    expect(payload.error).not.toMatch(/已注册/);
  });
});
