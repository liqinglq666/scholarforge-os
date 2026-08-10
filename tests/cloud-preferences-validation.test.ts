import { cookies } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT as saveCloudPreferences } from '@/app/api/preferences/cloud/route';
import { MAX_REQUEST_BYTES } from '@/lib/config';
import {
  CloudPreferencesValidationError,
  parseCloudPreferencesWrite,
} from '@/lib/preferences/validation';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const PUBLISHABLE_KEY = 'sb_publishable_12345678901234567890';
const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'researcher@example.com',
};

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cloud preference write validation', () => {
  it('rejects non-object, empty, manuscript-only, and mistyped preference payloads', () => {
    expect(() => parseCloudPreferencesWrite('bad')).toThrow(CloudPreferencesValidationError);
    expect(() => parseCloudPreferencesWrite({})).toThrow(/没有可保存的偏好字段/);
    expect(() => parseCloudPreferencesWrite({ sourceText: 'private manuscript' })).toThrow(/没有可保存的偏好字段/);
    expect(() => parseCloudPreferencesWrite({ englishVariant: 123 })).toThrow(/englishVariant/);
    expect(() => parseCloudPreferencesWrite({ chapterTemplate: [] })).toThrow(/chapterTemplate/);
  });

  it('keeps compatible partial preferences while dropping unknown manuscript-like fields', () => {
    const preferences = parseCloudPreferencesWrite({
      discipline: 'Materials Science',
      englishVariant: 'uk',
      sourceText: 'unpublished manuscript text',
      supervisorFeedback: 'private supervisor note',
    });

    expect(preferences.discipline).toBe('Materials Science');
    expect(preferences.englishVariant).toBe('uk');
    expect(preferences).not.toHaveProperty('sourceText');
    expect(preferences).not.toHaveProperty('supervisorFeedback');
  });

  it('returns 400 for malformed preferences without calling the preferences upsert endpoint', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify(USER), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected upstream call: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await saveCloudPreferences(new Request(
      'https://scholarforge.example/api/preferences/cloud',
      {
        method: 'PUT',
        headers: sameOriginHeaders(),
        body: JSON.stringify({ preferences: 'bad' }),
      },
    ));

    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toMatch(/偏好数据必须是对象/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/v1/user');
  });

  it('returns 413 for oversized preference payloads before any database write', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify(USER), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected upstream call: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const body = JSON.stringify({
      preferences: { discipline: 'A'.repeat(MAX_REQUEST_BYTES + 1) },
    });
    const response = await saveCloudPreferences(new Request(
      'https://scholarforge.example/api/preferences/cloud',
      {
        method: 'PUT',
        headers: sameOriginHeaders(),
        body,
      },
    ));

    expect(response.status).toBe(413);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/v1/user');
  });
});
