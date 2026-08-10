import { cookies } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GET as getSession,
  POST as login,
} from '@/app/api/auth/session/route';
import { POST as signUp } from '@/app/api/auth/sign-up/route';
import { GET as getCloudPreferences } from '@/app/api/preferences/cloud/route';
import { supabaseRequest } from '@/lib/auth/supabase';
import { SUPABASE_REQUEST_TIMEOUT_MS } from '@/lib/config';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const PUBLISHABLE_KEY = 'sb_publishable_12345678901234567890';

function sameOriginHeaders() {
  return {
    'content-type': 'application/json',
    host: 'scholarforge.example',
    origin: 'https://scholarforge.example',
    'sec-fetch-site': 'same-origin',
    'x-forwarded-host': 'scholarforge.example',
    'x-forwarded-proto': 'https',
  };
}

function credentialsBody() {
  return JSON.stringify({
    email: 'researcher@example.com',
    password: 'correct-password',
  });
}

function authSessionPayload(accessToken = 'new-access-token', refreshToken = 'new-refresh-token') {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'researcher@example.com',
    },
  };
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', PUBLISHABLE_KEY);
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => name === 'scholarforge-access-token'
      ? { name, value: 'existing-access-token' }
      : undefined,
  } as Awaited<ReturnType<typeof cookies>>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Supabase outage and session preservation', () => {
  it('returns 503 without clearing auth cookies when session validation cannot reach Supabase', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network unavailable');
    }));

    const response = await getSession();
    const payload = await response.json() as { message?: string };

    expect(response.status).toBe(503);
    expect(payload.message).toMatch(/凭据已保留/);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears cookies only when access and refresh credentials are explicitly rejected', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => {
        if (name === 'scholarforge-access-token') return { name, value: 'expired-access-token' };
        if (name === 'scholarforge-refresh-token') return { name, value: 'expired-refresh-token' };
        return undefined;
      },
    } as Awaited<ReturnType<typeof cookies>>);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return Response.json({ error: 'invalid token' }, { status: 401 });
      if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
        return Response.json({ error: 'invalid refresh token' }, { status: 400 });
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    const response = await getSession();
    const payload = await response.json() as { authenticated?: boolean };

    expect(response.status).toBe(200);
    expect(payload.authenticated).toBe(false);
    expect(response.headers.get('set-cookie') || '').toContain('Max-Age=0');
  });

  it('maps login and signup network failures to recoverable 503 responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network unavailable');
    }));

    const loginResponse = await login(new Request('https://scholarforge.example/api/auth/session', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: credentialsBody(),
    }));
    const signupResponse = await signUp(new Request('https://scholarforge.example/api/auth/sign-up', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: credentialsBody(),
    }));

    expect(loginResponse.status).toBe(503);
    expect((await loginResponse.json() as { error: string }).error).toMatch(/暂时不可用/);
    expect(signupResponse.status).toBe(503);
    expect((await signupResponse.json() as { error: string }).error).toMatch(/暂时不可用/);
  });

  it('does not turn a cloud-preference session check outage into an unauthorized cookie clear', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network unavailable');
    }));

    const response = await getCloudPreferences();

    expect(response.status).toBe(503);
    expect((await response.json() as { error: string }).error).toMatch(/凭据已保留/);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('returns refreshed cookies even when the following cloud-preference read fails', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => name === 'scholarforge-refresh-token'
        ? { name, value: 'old-refresh-token' }
        : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
        return Response.json(authSessionPayload());
      }
      if (url.includes('/rest/v1/user_preferences')) {
        throw new TypeError('preferences service unavailable');
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    const response = await getCloudPreferences();
    const cookieHeader = response.headers.get('set-cookie') || '';

    expect(response.status).toBe(503);
    expect(cookieHeader).toContain('new-access-token');
    expect(cookieHeader).toContain('new-refresh-token');
    expect(cookieHeader).not.toContain('Max-Age=0');
  });

  it('aborts a hanging Supabase request at the configured timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      return await new Promise<Response>((resolve, reject) => {
        void resolve;
        const signal = init?.signal;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    }));

    const requestPromise = supabaseRequest('/auth/v1/user', { method: 'GET' }, 'token');
    const expectation = expect(requestPromise).rejects.toMatchObject({
      name: 'SupabaseRequestFailure',
      reason: 'timeout',
    });

    await vi.advanceTimersByTimeAsync(SUPABASE_REQUEST_TIMEOUT_MS);
    await expectation;
  });
});
