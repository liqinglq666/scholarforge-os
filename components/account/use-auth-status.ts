'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthStatus } from '@/lib/types';

const FALLBACK_AUTH_STATUS: AuthStatus = {
  configured: false,
  authenticated: false,
  user: null,
  message: '暂时无法读取账户状态，仍可使用游客本地模式。',
};

async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) return FALLBACK_AUTH_STATUS;
    return await response.json() as AuthStatus;
  } catch {
    return FALLBACK_AUTH_STATUS;
  }
}

export function useAuthStatus() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const mountedRef = useRef(false);

  const reloadStatus = useCallback(async () => {
    const nextStatus = await fetchAuthStatus();
    if (mountedRef.current) setStatus(nextStatus);
    return nextStatus;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const handleAuthChange = () => { void reloadStatus(); };
    void reloadStatus();
    window.addEventListener('scholarforge-auth-change', handleAuthChange);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('scholarforge-auth-change', handleAuthChange);
    };
  }, [reloadStatus]);

  return { status, setStatus, reloadStatus };
}
