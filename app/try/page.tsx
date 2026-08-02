import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '直接体验',
  description: '无需登录，使用公开科研案例体验真实 AI 审校、科研事实安全门和作者逐条决策。',
};

const steps = [
  {
    title: '载入公开科研案例',
    description: '推荐案例来自生命医学讨论段，包含横断面研究中常见的因果表达风险。',
  },
  {
    title: '确认后调用真实模型',
    description: '页面会明确列出发送内容。只有点击确认后，案例文本才会发送到服务端模型。',
  },
  {
    title: '查看安全门逐项证据',
    description: '检查数字、单位、引用、术语、实验声明、因果边界、结论强度和研究范围。',
  },
  {
    title: '形成作者工作稿',
    description: '接受、拒绝或暂缓每条建议；只有代码允许的局部建议才能自动应用。',
  },
];

export default function TryPage() {
  return (
    <main className="shell page-main experience-page" id="main-content">
      <section className="experience-hero">
        <div>
          <span className="eyebrow">Public evaluation path</span>
          <h1>无需登录，直接体验核心功能</h1>
          <p>这是正式产品的公开体验路径，不是预录演示。案例会先填入浏览器本地草稿，由你主动确认后调用真实阿里云百炼模型。</p>
          <div className="competition-actions">
            <Link className="primary-link" href="/workspace?example=biomed-precheck">载入推荐案例并开始</Link>
            <Link className="secondary-link" href="/workspace">使用自己的文本</Link>
          </div>
        </div>
        <div className="experience-meta" aria-label="体验条件">
          <article><strong>登录要求</strong><span>不需要账号，可全程使用游客模式</span></article>
          <article><strong>API Key</strong><span>由服务端安全配置，体验者无需填写</span></article>
          <article><strong>预计操作</strong><span>4 个步骤，可独立完成</span></article>
          <article><strong>数据范围</strong><span>推荐案例是公开合成科研文本</span></article>
        </div>
      </section>

      <section className="experience-flow" aria-label="推荐体验步骤">
        {steps.map((step, index) => (
          <article key={step.title}><b>0{index + 1}</b><strong>{step.title}</strong><p>{step.description}</p></article>
        ))}
      </section>

      <section className="competition-section" aria-labelledby="experience-observe-title">
        <div className="competition-section-heading">
          <div><span className="eyebrow">建议重点观察</span><h2 id="experience-observe-title">评估的不是“文案更漂亮”，而是修改是否仍忠实于证据</h2></div>
          <p>推荐案例中，研究为横断面设计。系统应提醒作者不能从相关关系直接推断因果，也不能把特定样本扩大为所有大学生。</p>
        </div>
        <div className="competition-feature-grid">
          <article><span>BOUNDARY</span><h3>因果关系</h3><p>观察系统如何处理 “causes” 与 “was associated with” 的差异。</p></article>
          <article><span>SCOPE</span><h3>研究范围</h3><p>观察系统是否保留样本、研究设计和外推限制。</p></article>
          <article><span>CONTROL</span><h3>作者权限</h3><p>确认 AI 候选稿不会自动覆盖作者工作稿。</p></article>
          <article><span>TRACEABILITY</span><h3>可追踪修改</h3><p>体验逐条决定、安全应用、撤回、撤销和导出。</p></article>
        </div>
      </section>
    </main>
  );
}
