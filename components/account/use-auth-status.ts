'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthStatus } from '@/lib/types';

const AUTH_STATUS_CACHE_MS = 10_000;

const FALLBACK_AUTH_STATUS: AuthStatus = {
  configured: false,
  authenticated: false,
  user: null,
  message: '暂时无法读取账户状态，仍可使用游客本地模式。',
};

type AuthStatusSnapshot = {
  status: AuthStatus;
  fetchedAt: number;
};

let cachedSnapshot: AuthStatusSnapshot | null = null;
let pendingRequest: Promise<AuthStatus> | null = null;

function hasFreshSnapshot() {
  return cachedSnapshot && Date.now() - cachedSnapshot.fetchedAt < AUTH_STATUS_CACHE_MS;
}

async function fetchAuthStatus(force = false): Promise<AuthStatus> {
  if (!force && hasFreshSnapshot() && cachedSnapshot) return cachedSnapshot.status;
  if (pendingRequest) return pendingRequest;

  pendingRequest = fetch('/api/auth/session', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return FALLBACK_AUTH_STATUS;
      return response.json() as Promise<AuthStatus>;
    })
    .catch(() => FALLBACK_AUTH_STATUS)
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
