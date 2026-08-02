import { cookies } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE as signOut,
  GET as getSession,
  POST as login,
} from '@/app/api/auth/session/route';
import { POST as signUp } from '@/app/api/auth/sign-up/route';
import { PUT as saveCloudPreferences } from '@/app/api/preferences/cloud/route';
import {
  assertSameOrigin,
  getSupabaseConfig,
  isSafePublishableKey,
} from '@/lib/auth/supabase';

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

function authSessionPayload() {
  return {
    access_token: 'access-token-value',
    refresh_token: 'refresh-token-value',
    expires_in: 3600,
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'researcher@example.com',
      user_metadata: { display_name: 'Researcher' },
    },
  };
}

describe('Supabase authentication security', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', PUBLISHABLE_KEY);
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => name === 'scholarforge-access-token'
        ? { name, value: 'access-token-value' }
        : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('accepts publishable and legacy anon keys but rejects privileged keys', () => {
    const anonPayload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
    const servicePayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');

    expect(isSafePublishableKey(PUBLISHABLE_KEY)).toBe(true);
    expect(isSafePublishableKey(`header.${anonPayload}.signature`)).toBe(true);
    expect(isSafePublishableKey('sb_secret_do-not-use')).toBe(false);
    expect(isSafePublishableKey(`header.${servicePayload}.signature`)).toBe(false);
  });

  it('refuses to configure auth with a secret key', () => {
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_secret_do-not-use');
    expect(getSupabaseConfig()).toBeNull();
  });

  it('requires an exact same-origin mutation request', () => {
    const accepted = new Request('https://scholarforge.example/api/auth/session', {
      method: 'POST',
      headers: sameOriginHeaders(),
    });
    expect(() => assertSameOrigin(accepted)).not.toThrow();

    const missingOrigin = new Request('https://scholarforge.example/api/auth/session', {
      method: 'POST',
      headers: { host: 'scholarforge.example' },
    });
    expect(() => assertSameOrigin(missingOrigin)).toThrow(/请求来源/);

    const crossSite = new Request('https://scholarforge.example/api/auth/session', {
      method: 'POST',
      headers: {
        ...sameOriginHeaders(),
        origin: 'https://attacker.example',
        'sec-fetch-site': 'cross-site',
      },
    });
    expect(() => assertSameOrigin(crossSite)).toThrow(/跨站请求/);
  });

  it('stores tokens only in hardened HttpOnly cookies after login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify(authSessionPayload()),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const response = await login(new Request('https://scholarforge.example/api/auth/session', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: JSON.stringify({ email: 'researcher@example.com', password: 'correct-password' }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.user.email).toBe('researcher@example.com');
    expect(JSON.stringify(payload)).not.toContain('access-token-value');
    const cookieHeader = response.headers.get('set-cookie') || '';
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('Secure');
    expect(cookieHeader).toContain('SameSite=lax');
    expect(cookieHeader).toContain('Priority=high');
  });

  it('rotates cookies when an access token is refreshed', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => name === 'scholarforge-refresh-token'
        ? { name, value: 'old-refresh-token' }
        : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify(authSessionPayload()),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));

    const response = await getSession();
    const payload = await response.json();
    expect(payload.authenticated).toBe(true);
    const cookieHeader = response.headers.get('set-cookie') || '';
    expect(cookieHeader).toContain('access-token-value');
    expect(cookieHeader).toContain('refresh-token-value');
  });

  it('revokes the upstream session when possible and always clears local cookies', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify(authSessionPayload().user), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(null, { status: 204 });
    }));

    const response = await signOut(new Request('https://scholarforge.example/api/auth/session', {
      method: 'DELETE',
      headers: sameOriginHeaders(),
    }));
    expect(response.status).toBe(200);
    expect((response.headers.get('set-cookie') || '')).toContain('Max-Age=0');
  });

  it('does not reveal whether a login or registration email exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'User not found' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )));
    const request = () => new Request('https://scholarforge.example/api/auth/session', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: JSON.stringify({ email: 'unknown@example.com', password: 'long-enough-password' }),
    });
    const loginResponse = await login(request());
    expect(await loginResponse.json()).toEqual({
      error: '邮箱或密码不正确，或邮箱尚未完成确认。',
    });

    const signUpResponse = await signUp(new Request('https://scholarforge.example/api/auth/sign-up', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: JSON.stringify({ email: 'unknown@example.com', password: 'long-enough-password' }),
    }));
    const signUpPayload = await signUpResponse.json();
    expect(signUpPayload.error).not.toMatch(/User not found|already registered/i);
  });

  it('syncs only validated preferences and drops manuscript-like fields', async () => {
    const requests: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
      if (url.endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify(authSessionPayload().user), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }));

    const response = await saveCloudPreferences(new Request(
      'https://scholarforge.example/api/preferences/cloud',
      {
        method: 'PUT',
        headers: sameOriginHeaders(),
        body: JSON.stringify({
          preferences: {
            discipline: 'Materials Science',
            englishVariant: 'uk',
            sourceText: 'unpublished manuscript text',
            supervisorFeedback: 'private supervisor note',
          },
        }),
      },
    ));

    expect(response.status).toBe(200);
    const saved = JSON.parse(requests.at(-1)?.body || '{}');
    expect(saved.user_id).toBe('00000000-0000-4000-8000-000000000001');
    expect(saved.preferences.discipline).toBe('Materials Science');
    expect(saved.preferences.englishVariant).toBe('uk');
    expect(saved.preferences).not.toHaveProperty('sourceText');
    expect(saved.preferences).not.toHaveProperty('supervisorFeedback');
  });
});
