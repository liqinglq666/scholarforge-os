'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountMenu } from '@/components/account/account-menu';

const navigation = [
  { href: '/project', label: '论文项目' },
  { href: '/workspace', label: '审校工作台' },
  { href: '/history', label: '最近任务' },
  { href: '/preferences', label: '个性化' },
  { href: '/settings', label: '设置' },
];

const projectPaths = new Set(['/project', '/feedback', '/versions']);

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link aria-label="ScholarForge OS 首页" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">SF</span>
          <span><b>ScholarForge</b><small>作者控制的科研英语工作台</small></span>
        </Link>
        <div className="header-actions">
          <nav aria-label="主要导航">
            {navigation.map((item) => {
              const active = pathname === item.href || (item.href === '/project' && projectPaths.has(pathname));
              return <Link aria-current={active ? 'page' : undefined} href={item.href} key={item.href} style={active ? { background: 'var(--brand-soft)', color: 'var(--brand-dark)' } : undefined}>{item.label}</Link>;
            })}
          </nav>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="shell footer-inner">
        <p>AI 只提供建议。科研事实、引用、统计结果和最终文本由作者核对。</p>
        <div><Link href="/preferences">个性化偏好</Link><Link href="/settings">数据处理与当前限制</Link><a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">GitHub</a></div>
      </div>
    </footer>
  );
}
