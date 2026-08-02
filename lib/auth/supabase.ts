import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
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
  refreshedSession?: SupabaseAuthSession;
}

export function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !publishableKey) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return null;
    return { url: url.toString().replace(/\/$/, ''), publishableKey };
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('host');
  if (!host || new URL(origin).host !== host) throw new Error('跨站请求已拒绝。');
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
  return fetch(`${config.url}${path}`, { ...init, headers, cache: 'no-store' });
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
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

export async function resolveAuthSession(): Promise<ResolvedAuthSession> {
  if (!getSupabaseConfig()) return { configured: false, accessToken: null, user: null };
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value || null;
  const refreshToken = store.get(REFRESH_COOKIE)?.value || null;

  if (accessToken) {
    try {
      const response = await supabaseRequest('/auth/v1/user', { method: 'GET' }, accessToken);
      if (response.ok) {
        const user = parseAuthUser(await response.json());
        if (user) return { configured: true, accessToken, user };
      }
    } catch {
      // Refresh below when possible.
    }
  }

  if (refreshToken) {
    try {
      const response = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (response.ok) {
        const refreshedSession = parseAuthSession(await response.json());
        if (refreshedSession) {
          return {
            configured: true,
            accessToken: refreshedSession.accessToken,
            user: refreshedSession.user,
            refreshedSession,
          };
        }
      }
    } catch {
      // Treat invalid/expired sessions as signed out.
    }
  }

  return { configured: true, accessToken: null, user: null };
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
