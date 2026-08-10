'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthStatus, AuthUser } from '@/lib/types';

const AUTH_STATUS_CACHE_MS = 10_000;
const AUTH_UNAVAILABLE_MESSAGE = '暂时无法确认账户状态。现有登录凭据已保留，仍可使用本地工作区。';

type AuthStatusSnapshot = {
  status: AuthStatus;
  fetchedAt: number;
};

let cachedSnapshot: AuthStatusSnapshot | null = null;
let pendingRequest: Promise<AuthStatus> | null = null;

function hasFreshSnapshot() {
  return cachedSnapshot && Date.now() - cachedSnapshot.fetchedAt < AUTH_STATUS_CACHE_MS;
}

export function preserveAuthStatusDuringOutage(
  previous: AuthStatus | null,
  message = AUTH_UNAVAILABLE_MESSAGE,
): AuthStatus {
  return {
    configured: previous?.configured ?? true,
    authenticated: previous?.authenticated ?? false,
    user: previous?.user ?? null,
    unavailable: true,
    message,
  };
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthUser>;
  return typeof user.id === 'string' && typeof user.email === 'string';
}

function isAuthStatusPayload(value: unknown): value is AuthStatus {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<AuthStatus>;
  if (
    typeof payload.configured !== 'boolean'
    || typeof payload.authenticated !== 'boolean'
    || typeof payload.message !== 'string'
    || (payload.unavailable !== undefined && typeof payload.unavailable !== 'boolean')
  ) return false;
  if (payload.user !== null && !isAuthUser(payload.user)) return false;
  if (payload.authenticated && !payload.user) return false;
  if (!payload.configured && payload.authenticated) return false;
  return true;
}

async function readResponse(response: Response): Promise<AuthStatus> {
  let payload: unknown;
  try {
    payload = await response.json() as unknown;
  } catch {
    return preserveAuthStatusDuringOutage(cachedSnapshot?.status || null);
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object'
      ? (payload as { message?: unknown; error?: unknown }).message
        || (payload as { error?: unknown }).error
      : null;
    return preserveAuthStatusDuringOutage(
      cachedSnapshot?.status || null,
      typeof message === 'string' && message.trim() ? message : AUTH_UNAVAILABLE_MESSAGE,
    );
  }

  if (!isAuthStatusPayload(payload)) {
    return preserveAuthStatusDuringOutage(cachedSnapshot?.status || null);
  }
  return { ...payload, unavailable: payload.unavailable === true };
}

async function fetchAuthStatus(force = false): Promise<AuthStatus> {
  if (!force && hasFreshSnapshot() && cachedSnapshot) return cachedSnapshot.status;
  if (pendingRequest) return pendingRequest;

  pendingRequest = fetch('/api/auth/session', { cache: 'no-store' })
    .then(readResponse)
    .catch(() => preserveAuthStatusDuringOutage(cachedSnapshot?.status || null))
    .then((status) => {
      cachedSnapshot = { status, fetchedAt: Date.now() };
      return status;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

export function useAuthStatus() {
  const initialStatus = hasFreshSnapshot() ? cachedSnapshot?.status || null : null;
  const [status, setStatus] = useState<AuthStatus | null>(initialStatus);
  const mountedRef = useRef(false);

  const reloadStatus = useCallback(async () => {
    const nextStatus = await fetchAuthStatus(true);
    if (mountedRef.current) setStatus(nextStatus);
    return nextStatus;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const handleAuthChange = () => { void reloadStatus(); };
    void fetchAuthStatus().then((nextStatus) => {
      if (mountedRef.current) setStatus(nextStatus);
    });
    window.addEventListener('scholarforge-auth-change', handleAuthChange);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('scholarforge-auth-change', handleAuthChange);
    };
  }, [reloadStatus]);

  return { status, setStatus, reloadStatus };
}
