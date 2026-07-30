'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';

function initials(value: string) {
  const clean = value.trim();
  if (!clean) return 'S';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export function AccountDock() {
  const pathname = usePathname();
  const { user, loading, signOut, supabaseConfigured } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  if (pathname === '/login') return null;

  if (loading) {
    return <div aria-label="正在读取账户会话" className="account-dock account-dock-loading"><span /></div>;
  }

  if (!user) {
    return (
      <Link className="account-login-entry" href="/login">
        <span className="account-entry-icon">人</span>
        <span><b>登录 / 注册</b><small>保存你的论文工作区</small></span>
      </Link>
    );
  }

  const modeLabel = user.mode === 'supabase'
    ? '云端账户'
    : user.mode === 'guest'
      ? '访客模式'
      : '本地演示账户';

  return (
    <div className="account-dock" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="account-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className={`account-avatar mode-${user.mode}`}>{initials(user.displayName)}</span>
        <span className="account-trigger-copy"><b>{user.displayName}</b><small>{modeLabel}</small></span>
        <span aria-hidden="true" className="account-chevron">⌄</span>
      </button>

      {open ? (
        <div className="account-menu" role="menu">
          <div className="account-menu-head">
            <span className={`account-avatar large mode-${user.mode}`}>{initials(user.displayName)}</span>
            <div><strong>{user.displayName}</strong><small>{user.email || '未绑定邮箱'}</small></div>
          </div>
          <div className="account-mode-note">
            <span className={`account-mode-dot mode-${user.mode}`} />
            <div>
              <b>{modeLabel}</b>
              <small>{user.mode === 'supabase'
                ? '账户会话由 Supabase Auth 管理。'
                : supabaseConfigured
                  ? '当前未使用云端账户，草稿仍只保存在本机。'
                  : '配置 Supabase 后可启用真实云端注册与登录。'}</small>
            </div>
          </div>
          {user.mode !== 'supabase' && supabaseConfigured ? (
            <Link className="account-menu-link" href="/login" onClick={() => setOpen(false)} role="menuitem">
              升级为云端账户 <span>→</span>
            </Link>
          ) : null}
          <button
            className="account-signout"
            onClick={async () => {
              await signOut();
              setOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            退出当前会话
          </button>
        </div>
      ) : null}
    </div>
  );
}
