import type { Metadata } from 'next';
import Link from 'next/link';
import { TryServiceStatus } from '@/components/try/service-status';

export const metadata: Metadata = {
  title: '直接体验',
  description: '无需登录，使用公开合成科研案例体验真实 AI 审校、科研事实安全门和作者逐条决策。',
};

const observations = [
  ['因果边界', '横断面研究中的“相关”不能被改写为“导致”。'],
  ['研究范围', '特定样本的结果不能被扩大为所有大学生。'],
];

export default function TryPage() {
  return (
    <main className="shell page-main try-page" id="main-content">
      <section className="try-hero">
        <div className="try-copy">
          <span className="product-label">评委快速开始</span>
          <h1>用一个公开案例体验核心安全流程</h1>
          <p>案例会先载入当前浏览器草稿。你可以检查文本和设置，确认后再调用模型分析。</p>
          <TryServiceStatus />
          <div className="editorial-actions">
            <Link className="primary-link" href="/workspace?example=biomed-precheck">载入案例并开始</Link>
            <Link className="secondary-link" href="/workspace">使用自己的文本</Link>
          </div>
          <dl className="try-facts">
            <div><dt>账号</dt><dd>不需要</dd></div>
            <div><dt>API Key</dt><dd>不需要填写</dd></div>
            <div><dt>体验步骤</dt><dd>4 步</dd></div>
            <div><dt>案例数据</dt><dd>公开合成文本</dd></div>
          </dl>
        </div>

        <article className="case-preview">
          <header><span>推荐案例</span><strong>生命医学 · Discussion</strong></header>
          <div className="case-preview-meta"><span>投稿前检查</span><span>横断面研究</span></div>
          <blockquote>
            Participants who slept less than 6 h had higher anxiety scores. Because the study was cross-sectional, temporal ordering could not be established, and the findings should not be interpreted as evidence of causation.
          </blockquote>
          <div className="case-observations">
            {observations.map(([title, description]) => (
              <section key={title}><span aria-hidden="true">!</span><div><strong>{title}</strong><p>{description}</p></div></section>
            ))}
          </div>
          <footer><span>重点观察</span><strong>AI 候选是否改变证据边界</strong></footer>
        </article>
      </section>

      <section className="try-process" aria-labelledby="try-process-title">
        <div className="section-intro compact-intro">
          <span className="product-label">体验路径</span>
          <h2 id="try-process-title">每一步都由体验者主动确认</h2>
        </div>
        <ol>
          <li><span>01</span><div><strong>载入草稿</strong><p>公开案例只写入浏览器本地工作区。</p></div></li>
          <li><span>02</span><div><strong>确认发送</strong><p>页面列出正文、任务和术语规则后再请求模型。</p></div></li>
          <li><span>03</span><div><strong>查看安全证据</strong><p>先判断候选稿是否被隔离，再处理问题。</p></div></li>
          <li><span>04</span><div><strong>形成作者稿</strong><p>接受、拒绝、应用、撤销并导出。</p></div></li>
        </ol>
      </section>

      <section className="try-boundary-note">
        <div><strong>安全门通过仍需作者核对</strong><p>系统不验证原始数据、统计方法、参考文献内容、伦理合规或期刊最新规则。</p></div>
        <Link className="text-link" href="/trust">查看完整安全边界 →</Link>
      </section>
    </main>
  );
}
