'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell page-main" id="main-content">
      <div className="empty-state large" role="alert"><strong>页面没有正常加载</strong><p>你的浏览器工作区没有被删除。可以重试；若问题持续，请先从“数据与设置”导出备份。</p><button className="primary-button" onClick={reset} type="button">重新加载</button></div>
    </main>
  );
}
