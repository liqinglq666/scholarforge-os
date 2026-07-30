'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';

const PUBLIC_PATHS = new Set(['/login']);

export function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublicPath) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/login?next=${next}`);
    }
  }, [isPublicPath, loading, pathname, router, user]);

  if (isPublicPath) return children;

  if (loading || !user) {
    return (
      <main className="auth-gate-loading" aria-live="polite" aria-busy="true">
        <div className="auth-gate-card">
          <span className="auth-gate-mark">S</span>
          <div>
            <strong>正在验证账户会话</strong>
            <small>即将进入 ScholarForge OS 审校工作台</small>
          </div>
          <span className="auth-gate-spinner" aria-hidden="true" />
        </div>
      </main>
    );
  }

  return children;
}
