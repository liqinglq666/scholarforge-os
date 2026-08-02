'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountMenu } from '@/components/account/account-menu';

const primaryNavigation = [
  { href: '/project', label: '论文项目' },
  { href: '/workspace', label: '审校工作台' },
  { href: '/history', label: '最近任务' },
];

const utilityNavigation = [
  { href: '/preferences', label: '个性化' },
  { href: '/settings', label: '设置' },
];

const projectPaths = new Set(['/project', '/feedback', '/versions']);

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href === '/project' && projectPaths.has(pathname));
}

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link aria-label="ScholarForge OS 首页" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">SF</span>
          <span className="brand-copy">
            <b>ScholarForge</b>
            <small>作者控制的科研写作工作台</small>
          </span>
        </Link>

        <div className="header-actions">
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

          <div className="utility-navigation">
            <nav aria-label="偏好与设置" className="utility-nav">
              {utilityNavigation.map((item) => {
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
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="shell footer-inner">
        <div className="footer-message">
          <span aria-hidden="true" className="footer-mark">SF</span>
          <p><strong>AI 提建议，作者做决定。</strong><span>科研事实、引用、统计结果和最终文本由作者核对。</span></p>
        </div>
        <nav aria-label="页脚导航">
          <Link href="/preferences">个性化偏好</Link>
          <Link href="/settings">数据与限制</Link>
          <a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
