'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AuthStatus } from '@/lib/types';

export function AccountMenu() {
  const [status, setStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const value = await response.json() as AuthStatus;
        if (active) setStatus(value);
      } catch {
        if (active) setStatus({ configured: false, authenticated: false, user: null, message: '游客模式' });
      }
    }
    void load();
    window.addEventListener('scholarforge-auth-change', load);
    return () => {
      active = false;
      window.removeEventListener('scholarforge-auth-change', load);
    };
  }, []);

  const label = !status
    ? '账户'
    : status.authenticated && status.user
      ? status.user.displayName || status.user.email.split('@')[0]
      : status.configured ? '登录' : '游客模式';
  const href = status?.configured && !status.authenticated ? '/login' : '/account';

  return <Link className="account-menu-link" href={href} title={status?.message || '查看账户状态'}>{label}</Link>;
}
