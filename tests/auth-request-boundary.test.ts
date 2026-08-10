import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as login } from '@/app/api/auth/session/route';
import { POST as signUp } from '@/app/api/auth/sign-up/route';
import { MAX_AUTH_REQUEST_BYTES } from '@/lib/config';

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

function authBody() {
  return JSON.stringify({
    email: 'researcher@example.com',
    password: 'correct-password',
  });
}

function streamedRequest(url: string, chunks: Uint8Array[]) {
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (!chunk) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
  });
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers: sameOriginHeaders(),
    body: stream,
    duplex: 'half',
  };
  return new Request(url, init);
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

describe('authentication request boundaries', () => {
  it('rejects a login request whose declared body is larger than 8 KB before contacting Supabase', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await login(new Request('https://scholarforge.example/api/auth/session', {
      method: 'POST',
      headers: {
        ...sameOriginHeaders(),
        'content-length': String(MAX_AUTH_REQUEST_BYTES + 1),
      },
      body: '{}',
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: '登录请求过大。' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized streamed signup request without Content-Length before contacting Supabase', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = streamedRequest(
      'https://scholarforge.example/api/auth/sign-up',
      [new Uint8Array(MAX_AUTH_REQUEST_BYTES + 1).fill(65)],
    );

    expect(request.headers.get('content-length')).toBeNull();
    const response = await signUp(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: '注册请求过大。' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when a successful login response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>gateway page</html>', { status: 200 })));
    const response = await login(new Request('https://scholarforge.example/api/auth/session', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: authBody(),
    }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: '账户服务返回了无法解析的会话。' });
  });

  it('fails closed when a successful signup response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', { status: 200 })));
    const response = await signUp(new Request('https://scholarforge.example/api/auth/sign-up', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: authBody(),
    }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: '账户服务返回了无法解析的注册结果。' });
  });

  it('does not mistake an empty successful signup payload for an email-confirmation flow', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({})));
    const response = await signUp(new Request('https://scholarforge.example/api/auth/sign-up', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: authBody(),
    }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: '账户服务返回了无效注册结果。' });
  });

  it('continues to accept a valid pending-email-confirmation signup result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'researcher@example.com',
      },
      session: null,
    })));
    const response = await signUp(new Request('https://scholarforge.example/api/auth/sign-up', {
      method: 'POST',
      headers: sameOriginHeaders(),
      body: authBody(),
    }));
    const payload = await response.json() as { authenticated?: boolean; message?: string };

    expect(response.status).toBe(200);
    expect(payload.authenticated).toBe(false);
    expect(payload.message).toMatch(/检查邮箱/);
  });
});
