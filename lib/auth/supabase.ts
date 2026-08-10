import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SUPABASE_REQUEST_TIMEOUT_MS } from '@/lib/config';
import type { AuthUser } from '@/lib/types';
import { isRecord } from '@/lib/validation/common';

const ACCESS_COOKIE = 'scholarforge-access-token';
const REFRESH_COOKIE = 'scholarforge-refresh-token';

export interface SupabaseAuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface ResolvedAuthSession {
  configured: boolean;
  accessToken: string | null;
  user: AuthUser | null;
  unavailable: boolean;
  refreshedSession?: SupabaseAuthSession;
}

export class SupabaseRequestFailure extends Error {
  constructor(public readonly reason: 'timeout' | 'network') {
    super(reason === 'timeout' ? 'Supabase request timed out.' : 'Supabase request failed.');
    this.name = 'SupabaseRequestFailure';
  }
}

export function isSafePublishableKey(value: string) {
  if (value.startsWith('sb_secret_') || value.startsWith('service_role')) return false;
  if (value.startsWith('sb_publishable_')) return value.length >= 32;

  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown;
    return isRecord(payload) && payload.role === 'anon';
  } catch {
    return false;
  }
}

export function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !publishableKey || !isSafePublishableKey(publishableKey)) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return null;
    return { url: url.toString().replace(/\/$/, ''), publishableKey };
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new Error('跨站请求已拒绝。');

  const origin = request.headers.get('origin');
  if (!origin) throw new Error('缺少请求来源，操作已拒绝。');

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get('host') || requestUrl.host;
    const expectedProtocol = forwardedProtocol || requestUrl.protocol.replace(':', '');
    const originUrl = new URL(origin);
    if (originUrl.host !== expectedHost || originUrl.protocol !== `${expectedProtocol}:`) {
      throw new Error('跨站请求已拒绝。');
    }
  } catch (error) {
    if (error instanceof Error && /请求已拒绝/.test(error.message)) throw error;
    throw new Error('请求来源无效，操作已拒绝。');
  }
}

export async function supabaseRequest(
  path: string,
  init: RequestInit = {},
  accessToken?: string | null,
) {
  const config = getSupabaseConfig();
  if (!config) throw new Error('账户服务未配置。');
  const headers = new Headers(init.headers);
  headers.set('apikey', config.publishableKey);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${config.url}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    throw new SupabaseRequestFailure(timedOut ? 'timeout' : 'network');
  } finally {
    clearTimeout(timeout);
  }
}

function parseAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.email !== 'string') return null;
  const metadata = isRecord(value.user_metadata) ? value.user_metadata : null;
  const displayName = metadata && typeof metadata.display_name === 'string'
    ? metadata.display_name.slice(0, 80)
    : undefined;
  return { id: value.id, email: value.email, ...(displayName ? { displayName } : {}) };
}

export function parseAuthSession(value: unknown): SupabaseAuthSession | null {
  if (!isRecord(value)) return null;
  const user = parseAuthUser(value.user);
  if (
    !user
    || typeof value.access_token !== 'string'
    || typeof value.refresh_token !== 'string'
    || typeof value.expires_in !== 'number'
  ) return null;
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresIn: Math.max(60, Math.min(value.expires_in, 86_400)),
    user,
  };
}

export function applyAuthCookies(response: NextResponse, session: SupabaseAuthSession) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: session.expiresIn,
    priority: 'high',
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    priority: 'high',
  });
}

export function clearAuthCookies(response: NextResponse) {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    priority: 'high' as const,
  };
  response.cookies.set(ACCESS_COOKIE, '', options);
  response.cookies.set(REFRESH_COOKIE, '', options);
}

function isCredentialRejection(status: number) {
  return status === 400 || status === 401 || status === 403;
}

export async function resolveAuthSession(): Promise<ResolvedAuthSession> {
  if (!getSupabaseConfig()) {
    return { configured: false, accessToken: null, user: null, unavailable: false };
  }
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value || null;
  const refreshToken = store.get(REFRESH_COOKIE)?.value || null;
  let transientFailure = false;

  if (accessToken) {
    try {
      const response = await supabaseRequest('/auth/v1/user', { method: 'GET' }, accessToken);
      if (response.ok) {
        try {
          const user = parseAuthUser(await response.json());
          if (user) return { configured: true, accessToken, user, unavailable: false };
          transientFailure = true;
        } catch {
          transientFailure = true;
        }
      } else if (!isCredentialRejection(response.status)) {
        transientFailure = true;
      }
    } catch (error) {
      if (error instanceof SupabaseRequestFailure) transientFailure = true;
      else throw error;
    }
  }

  if (refreshToken) {
    try {
      const response = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (response.ok) {
        try {
          const refreshedSession = parseAuthSession(await response.json());
          if (refreshedSession) {
            return {
              configured: true,
              accessToken: refreshedSession.accessToken,
              user: refreshedSession.user,
              unavailable: false,
              refreshedSession,
            };
          }
          transientFailure = true;
        } catch {
          transientFailure = true;
        }
      } else if (!isCredentialRejection(response.status)) {
        transientFailure = true;
      }
    } catch (error) {
      if (error instanceof SupabaseRequestFailure) transientFailure = true;
      else throw error;
    }
  }

  if (transientFailure) {
    return { configured: true, accessToken: null, user: null, unavailable: true };
  }
  return { configured: true, accessToken: null, user: null, unavailable: false };
}

export async function readSupabaseError(response: Response, fallback: string) {
  try {
    const payload = await response.json() as unknown;
    if (isRecord(payload)) {
      const value = payload.msg || payload.message || payload.error_description || payload.error;
      if (typeof value === 'string' && value.length <= 300) return value;
    }
  } catch {
    // Use the author-facing fallback below.
  }
  return fallback;
}
