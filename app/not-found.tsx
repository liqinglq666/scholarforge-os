import Link from 'next/link';

export default function NotFound() {
  return <main className="shell page-main" id="main-content"><div className="empty-state large"><strong>找不到这个页面</strong><p>链接可能已经变化。你的本地工作区不受影响。</p><Link className="primary-link" href="/">返回首页</Link></div></main>;
}
