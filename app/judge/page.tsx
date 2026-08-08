import type { Metadata } from 'next';
import Link from 'next/link';
import { JudgeExperience } from '@/components/judge/judge-experience';

export const metadata: Metadata = {
  title: '90 秒评审体验',
  description: '用三个公开合成案例看懂 ScholarForge 如何把 AI 修改变成可验证、可隔离、由作者最终授权的受控操作。',
};

const passportFields = [
  ['原文与 AI 候选', '清楚记录修改前后内容，而不是只给一个模糊风险分数。'],
  ['规则与证据', '指出究竟是哪条科研事实规则触发，以及可核对的变化证据。'],
  ['状态与权限', 'passed、quarantined 与自动应用权限被明确分开。'],
  ['作者最终决定', '即使通过当前规则，也必须由作者接受、拒绝或暂缓。'],
];

export default function JudgePage() {
  return (
    <main className="judge-page" id="main-content">
      <section className="judge-hero">
        <div className="shell judge-hero-grid">
          <div className="judge-hero-copy">
            <span className="product-label">外滩大会 2026 · 90 秒评审体验</span>
            <h1>每一次 AI 修改，都先证明自己没有越界。</h1>
            <p>
              ScholarForge 不让模型直接覆盖论文。每条候选修改都会生成一张
              <strong> Verified Edit Passport｜科研修改通行证</strong>，记录规则、证据、状态和权限，再交给作者决定。
            </p>
            <div className="editorial-actions">
              <a className="primary-link" href="#judge-experience">开始 90 秒体验</a>
              <Link className="secondary-link" href="/try">体验真实公开案例</Link>
            </div>
            <p className="hero-assurance">固定合成案例 · 不调用模型 · 不写入工作区 · 重点展示真实安全机制</p>
          </div>

          <article className="judge-passport-preview" aria-label="科研修改通行证示例">
            <header>
              <div>
                <span>Verified Edit Passport</span>
                <strong>VEP-001</strong>
              </div>
              <b>BLOCKED</b>
            </header>
            <div className="judge-preview-text">
              <section>
                <span>作者原文</span>
                <p>The compressive strength increased from 42.6 MPa to <mark className="judge-mark judge-mark-safe">48.3 MPa</mark>.</p>
              </section>
              <section>
                <span>AI 候选</span>
                <p>The compressive strength increased from 42.6 MPa to <mark className="judge-mark judge-mark-risk">58.3 MPa</mark>.</p>
              </section>
            </div>
            <dl>
              <div><dt>规则</dt><dd>Numerical invariant</dd></div>
              <div><dt>证据</dt><dd>48.3 MPa ≠ 58.3 MPa</dd></div>
              <div><dt>状态</dt><dd>quarantined</dd></div>
              <div><dt>自动应用</dt><dd>禁止</dd></div>
              <div><dt>最终控制者</dt><dd>作者</dd></div>
            </dl>
          </article>
        </div>
      </section>

      <section className="shell judge-passport-explainer" aria-labelledby="passport-title">
        <div className="judge-section-heading">
          <div>
            <span className="product-label">Verified Edit Passport</span>
            <h2 id="passport-title">把“AI 润色”变成一项可审计的受控操作</h2>
          </div>
          <p>
            评委不需要先理解提示词或底层代码，只要看一张通行证，就能知道这次 AI 到底改了什么、为什么被允许或阻断，以及谁拥有最终决定权。
          </p>
        </div>
        <div className="judge-passport-grid">
          {passportFields.map(([title, description], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <JudgeExperience />

      <section className="shell judge-boundary" aria-labelledby="judge-boundary-title">
        <div>
          <span className="product-label">真实边界</span>
          <h2 id="judge-boundary-title">Safety Gate 通过，不代表论文已经“科学正确”</h2>
          <p>它验证的是当前支持的修改风险规则，不替代原始数据核验、统计审查、伦理审查、参考文献核查或同行评议。</p>
        </div>
        <div className="editorial-actions">
          <Link className="primary-link" href="/try">继续体验真实公开案例</Link>
          <Link className="secondary-link" href="/trust">查看规则与测试边界</Link>
        </div>
      </section>
    </main>
  );
}
