import Link from 'next/link';

const permissions = [
  {
    number: '01',
    title: '模型只提出候选',
    description: 'AI 可以翻译、润色和指出问题，但不能覆盖作者工作稿，也不能为自己授予自动应用权限。',
  },
  {
    number: '02',
    title: '代码独立核验',
    description: '数值、单位、引用、术语、实验声明与证据边界由独立规则重新检查，并生成可核对证据。',
  },
  {
    number: '03',
    title: '作者决定最终文本',
    description: '每条建议都由作者接受、拒绝或暂缓；通过规则也不等于自动写入论文。',
  },
];

const workflow = [
  ['载入文本', '粘贴段落或在浏览器中提取 DOCX 章节。'],
  ['运行审校', '确认本次发送的正文、任务与术语规则。'],
  ['核对通行证', '查看修改类型、规则、证据、状态与自动应用权限。'],
  ['形成作者稿', '作者逐条决定，只应用代码允许的局部修改并导出。'],
];

export default function Home() {
  return (
    <main id="main-content">
      <section className="editorial-hero">
        <div className="shell editorial-hero-grid">
          <div className="editorial-hero-copy">
            <span className="product-label">外滩大会 2026 · 科研事实安全审校</span>
            <h1>AI 可以帮你改论文。谁来检查 AI 改错了没有？</h1>
            <p>
              ScholarForge 在 AI 候选与作者工作稿之间加入独立 Safety Gate，并为每一次修改生成
              <strong> Verified Edit Passport｜科研修改通行证</strong>：模型提出，代码核验，作者决定。
            </p>
            <div className="editorial-actions">
              <Link className="primary-link" href="/judge">90 秒看懂 ScholarForge</Link>
              <Link className="secondary-link" href="/try">体验真实公开案例</Link>
            </div>
            <p className="hero-assurance">评审演示不调用模型 · 真实分析前明确确认发送 · 不自动覆盖作者原稿</p>
          </div>

          <article className="gate-preview" aria-label="Verified Edit Passport 科研修改通行证预览">
            <header>
              <div>
                <span>Verified Edit Passport · VEP-001</span>
                <strong>科研修改通行证</strong>
              </div>
              <span className="gate-preview-status">BLOCKED</span>
            </header>
            <div className="gate-preview-copy">
              <section>
                <span>作者原文</span>
                <p>The compressive strength increased from 42.6 MPa to <span className="protected-value">48.3 MPa</span>.</p>
              </section>
              <section className="candidate-risk">
                <span>AI 危险候选</span>
                <p>The compressive strength increased from 42.6 MPa to <mark>58.3 MPa</mark>.</p>
              </section>
            </div>
            <ul className="gate-preview-findings">
              <li><span aria-hidden="true">!</span><div><strong>Numerical invariant</strong><small>48.3 MPa ≠ 58.3 MPa</small></div><b>已阻断</b></li>
              <li><span aria-hidden="true">!</span><div><strong>状态：quarantined</strong><small>危险候选不能进入自动应用流程</small></div><b>已隔离</b></li>
              <li className="protected"><span aria-hidden="true">✓</span><div><strong>最终控制者：作者</strong><small>工作稿保持原文，决定权不会交给模型</small></div><b>已保护</b></li>
            </ul>
            <footer><span>自动应用权限</span><strong>0</strong></footer>
          </article>
        </div>
      </section>

      <section className="permission-section shell" aria-labelledby="permission-title">
        <div className="section-intro compact-intro">
          <span className="product-label">Verified Edit Passport</span>
          <h2 id="permission-title">把每一次 AI 修改变成可审计的受控操作</h2>
          <p>不是给一个“安全分数”，而是明确记录改了什么、触发了什么规则、证据是什么、当前允许做什么。</p>
          <p className="home-passport-fields">通行证记录：原文 · AI 候选 · 修改类型 · 规则 · 证据 · 状态 · 自动应用权限 · 最终控制者</p>
        </div>
        <div className="permission-list">
          {permissions.map((item) => (
            <article key={item.number}>
              <span>{item.number}</span>
              <div><h3>{item.title}</h3><p>{item.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-section" aria-labelledby="workflow-title">
        <div className="shell workflow-layout">
          <div>
            <div className="section-intro">
              <span className="product-label">真实核心流程</span>
              <h2 id="workflow-title">四步完成一次可核对、可恢复的审校</h2>
              <p>评委可以先用 90 秒模式理解机制；真实工作台仍保留发送确认、逐条作者决策、撤销、重做与导出。</p>
            </div>
            <ol className="workflow-list">
              {workflow.map(([title, description], index) => (
                <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{description}</p></div></li>
              ))}
            </ol>
          </div>

          <div className="workspace-preview" aria-label="ScholarForge 工作台界面预览">
            <header>
              <div><span className="preview-dot" /><strong>Discussion 审校</strong></div>
              <span className="preview-safe-state">Safety Gate：通过当前规则</span>
            </header>
            <div className="workspace-preview-body">
              <aside>
                <span>任务</span>
                <strong>投稿前检查</strong>
                <span>章节</span>
                <strong>Discussion</strong>
                <span>术语规则</span>
                <strong>3 条</strong>
              </aside>
              <section>
                <div className="preview-document-heading"><span>作者工作稿</span><b>1,284 字符</b></div>
                <p>The findings suggest that sleep duration was associated with anxiety symptoms. Because the study was cross-sectional, temporal ordering could not be established.</p>
                <p>All values, study limitations, and author-year citations remain unchanged.</p>
              </section>
              <aside className="preview-issues">
                <div><span>VEP-014</span><strong>因果边界</strong><small>待作者决定</small></div>
                <div><span>VEP-015</span><strong>结论强度</strong><small>已拒绝</small></div>
                <div><span>VEP-016</span><strong>语言清晰度</strong><small>可进入作者审阅</small></div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="boundary-section shell" aria-labelledby="boundary-title">
        <div>
          <span className="product-label">边界透明</span>
          <h2 id="boundary-title">Safety Gate 通过不等于论文科学正确</h2>
          <p>系统降低 AI 修改带来的风险，但不替代作者、导师、统计专家、伦理审查或同行评议。</p>
        </div>
        <ul>
          <li>原始数据真实性</li>
          <li>统计方法正确性</li>
          <li>参考文献内容</li>
          <li>伦理合规</li>
          <li>期刊最新规则</li>
        </ul>
        <Link className="text-link" href="/trust">查看安全规则与测试范围 →</Link>
      </section>

      <section className="final-cta">
        <div className="shell">
          <span className="product-label">为评审而设计的最短路径</span>
          <h2>三个案例，90 秒看懂为什么 AI 没有最终权限</h2>
          <p>先看数字篡改、因果升级和安全润色，再进入真实公开案例体验完整工作流。</p>
          <Link className="primary-link" href="/judge">开始 90 秒评审体验</Link>
        </div>
      </section>
    </main>
  );
}
