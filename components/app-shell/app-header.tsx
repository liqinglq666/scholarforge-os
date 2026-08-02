import Link from 'next/link';

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link aria-label="ScholarForge OS 首页" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">SF</span>
          <span><b>ScholarForge</b><small>作者控制的科研英语工作台</small></span>
        </Link>
        <nav aria-label="主要导航">
          <Link href="/workspace">工作台</Link>
          <Link href="/history">最近任务</Link>
          <Link href="/settings">数据与设置</Link>
        </nav>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="shell footer-inner">
        <p>AI 只提供建议。科研事实、引用、统计结果和最终文本由作者核对。</p>
        <div><Link href="/settings">数据处理与当前限制</Link><a href="https://github.com/liqinglq666/scholarforge-os">GitHub</a></div>
      </div>
    </footer>
  );
}
