'use client';

import Link from 'next/link';
import { useAuthStatus } from '@/components/account/use-auth-status';

export function AccountMenu() {
  const { status } = useAuthStatus();
  const label = !status
    ? '账户'
    : status.authenticated && status.user
      ? status.user.displayName || status.user.email.split('@')[0]
      : status.configured ? '登录' : '游客模式';
  const href = status?.configured && !status.authenticated ? '/login' : '/account';

  return <Link className="account-menu-link" href={href} title={status?.message || '查看账户状态'}>{label}</Link>;
}
