'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountMenu } from '@/components/account/account-menu';

const primaryNavigation = [
  { href: '/try', label: '直接体验' },
  { href: '/projects', label: '论文项目' },
  { href: '/workspace', label: '快速审校' },
];

const utilityNavigation = [
  { href: '/trust', label: '安全与测试' },
  { href: '/guide', label: '使用手册' },
  { href: '/settings', label: '数据与隐私' },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/projects') return pathname === '/projects' || pathname.startsWith('/projects/');
  return pathname === href;
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
            <small>科研事实安全审校工作台</small>
          </span>
        </Link>

        <div className="header-actions">
          <nav aria-label="主要工作区" className="primary-nav">
            {primaryNavigation.map((item) => {
              const active = isActivePath(pathname, item.href);
              return <Link aria-current={active ? 'page' : undefined} className={active ? 'nav-link active' : 'nav-link'} href={item.href} key={item.href}>{item.label}</Link>;
            })}
          </nav>

          <div className="utility-navigation">
            <nav aria-label="帮助与设置" className="utility-nav">
              {utilityNavigation.map((item) => {
                const active = isActivePath(pathname, item.href);
                return <Link aria-current={active ? 'page' : undefined} className={active ? 'nav-link active' : 'nav-link'} href={item.href} key={item.href}>{item.label}</Link>;
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
          <p><strong>普通 AI 帮助修改论文，ScholarForge 负责阻止 AI 改错论文。</strong><span>AI 提建议，作者做决定。</span></p>
        </div>
        <nav aria-label="页脚导航">
          <Link href="/try">直接体验</Link>
          <Link href="/trust">安全与测试</Link>
          <Link href="/guide">使用手册</Link>
          <Link href="/settings">数据与隐私</Link>
          <a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
