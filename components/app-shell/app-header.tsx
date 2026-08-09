'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from '@/components/account/account-menu';

const primaryNavigation = [
  { href: '/judge', label: '90 秒评审' },
  { href: '/projects', label: '论文项目' },
  { href: '/workspace', label: '快速审校' },
  { href: '/trust', label: '安全说明' },
];

const secondaryNavigation = [
  { href: '/try', label: '完整公开体验' },
  { href: '/guide', label: '使用手册' },
  { href: '/settings', label: '数据与隐私' },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/projects') return pathname === '/projects' || pathname.startsWith('/projects/');
  return pathname === href;
}

export function AppHeader() {
  const pathname = usePathname();
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const mobileOpen = mobileOpenPath === pathname;
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpenPath(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  if (isLoginPage) {
    return (
      <header className="app-header login-auth-header">
        <div className="shell header-inner login-auth-header-inner">
          <Link aria-label="ScholarForge OS 首页" className="brand" href="/">
            <span aria-hidden="true" className="brand-mark">SF</span>
            <span className="brand-copy">
              <b>ScholarForge</b>
              <small>科研事实安全审校</small>
            </span>
          </Link>
          <nav aria-label="登录页快捷导航" className="login-auth-header-actions">
            <Link href="/">返回首页</Link>
            <Link className="login-auth-guest-link" href="/workspace">继续游客使用</Link>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link aria-label="ScholarForge OS 首页" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">SF</span>
          <span className="brand-copy">
            <b>ScholarForge</b>
            <small>科研事实安全审校</small>
          </span>
        </Link>

        <div className="desktop-navigation">
          <nav aria-label="主要工作区" className="primary-nav">
            {primaryNavigation.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'nav-link active' : 'nav-link'}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <details className="header-more">
            <summary aria-label="打开更多导航">更多</summary>
            <div className="header-more-panel">
              <nav aria-label="帮助与设置">
                {secondaryNavigation.map((item) => (
                  <Link aria-current={isActivePath(pathname, item.href) ? 'page' : undefined} href={item.href} key={item.href}>{item.label}</Link>
                ))}
              </nav>
              <AccountMenu />
            </div>
          </details>
        </div>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? '关闭导航菜单' : '打开导航菜单'}
          className={mobileOpen ? 'mobile-menu-toggle open' : 'mobile-menu-toggle'}
          onClick={() => setMobileOpenPath(mobileOpen ? null : pathname)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {mobileOpen ? (
        <div className="mobile-navigation-layer" id="mobile-navigation">
          <button aria-label="关闭导航菜单" className="mobile-navigation-backdrop" onClick={() => setMobileOpenPath(null)} type="button" />
          <div aria-modal="true" className="mobile-navigation-drawer" role="dialog">
            <div className="mobile-navigation-heading">
              <div><strong>ScholarForge</strong><span>选择下一步</span></div>
              <button aria-label="关闭导航菜单" onClick={() => setMobileOpenPath(null)} type="button">关闭</button>
            </div>
            <nav aria-label="开始使用" className="mobile-primary-links">
              <span>开始使用</span>
              {primaryNavigation.map((item) => (
                <Link aria-current={isActivePath(pathname, item.href) ? 'page' : undefined} href={item.href} key={item.href}>{item.label}</Link>
              ))}
            </nav>
            <div className="mobile-secondary-links">
              <span>帮助与账户</span>
              {secondaryNavigation.map((item) => (
                <Link aria-current={isActivePath(pathname, item.href) ? 'page' : undefined} href={item.href} key={item.href}>{item.label}</Link>
              ))}
              <AccountMenu />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="shell footer-inner">
        <div className="footer-message">
          <span aria-hidden="true" className="footer-mark">SF</span>
          <p><strong>让 AI 修改先通过科研事实安全门。</strong><span>模型提出候选，代码检查风险，作者决定最终文本。</span></p>
        </div>
        <nav aria-label="页脚导航">
          <Link href="/judge">90 秒评审</Link>
          <Link href="/try">完整公开体验</Link>
          <Link href="/trust">安全说明</Link>
          <Link href="/guide">使用手册</Link>
          <Link href="/settings">数据与隐私</Link>
          <a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
