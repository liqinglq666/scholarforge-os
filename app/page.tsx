import Link from 'next/link';

const permissions = [
  {
    number: '01',
    title: '模型只提出候选',
    description: 'AI 可以翻译、润色和指出问题，但不能覆盖作者工作稿，也不能为自己授予自动应用权限。',
  },
  {
    number: '02',
    title: '代码执行安全检查',
    description: '数值、单位、引用、术语、实验声明与证据边界由独立规则重新检查。',
  },
  {
    number: '03',
    title: '作者决定最终文本',
    description: '每条建议都由作者接受、拒绝或暂缓；已应用修改可以撤回、撤销并导出。',
  },
];

const workflow = [
  ['载入文本', '粘贴段落或在浏览器中提取 DOCX 章节。'],
  ['运行审校', '确认本次发送的正文、任务与术语规则。'],
  ['核对证据', '先查看安全门，再逐条检查 AI 建议。'],
  ['形成作者稿', '只应用代码允许的局部修改并导出。'],
];

export default function Home() {
  return (
    <main id="main-content">
      <section className="editorial-hero">
        <div className="shell editorial-hero-grid">
          <div className="editorial-hero-copy">
            <span className="product-label">科研事实安全审校工作台</span>
            <h1>让 AI 修改先通过科研事实安全门</h1>
            <p>AI 生成候选修改，代码检查数值、单位、引用与证据边界，作者决定最终文本。</p>
            <div className="editorial-actions">
              <Link className="primary-link" href="/try">直接体验公开案例</Link>
              <Link className="secondary-link" href="/projects">进入论文工作台</Link>
            </div>
            <p className="hero-assurance">无需登录 · 无需填写 API Key · 不自动覆盖作者原稿</p>
          </div>

          <article className="gate-preview" aria-label="科研事实安全门结果预览">
            <header>
              <div>
                <span>ScholarForge Safety Gate</span>
                <strong>候选稿已隔离</strong>
              </div>
              <span className="gate-preview-status">2 项阻断</span>
            </header>
            <div className="gate-preview-copy">
              <section>
                <span>原文</span>
                <p>Short sleep was associated with higher anxiety scores in this cross-sectional sample.</p>
              </section>
              <section className="candidate-risk">
                <span>AI 危险候选</span>
                <p>Short sleep <mark>causes</mark> anxiety in <mark>all university students</mark>.</p>
              </section>
            </div>
            <ul className="gate-preview-findings">
              <li><span aria-hidden="true">!</span><div><strong>因果关系升级</strong><small>was associated with → causes</small></div><b>已阻断</b></li>
              <li><span aria-hidden="true">!</span><div><strong>研究范围扩大</strong><small>this sample → all university students</small></div><b>已阻断</b></li>
              <li className="protected"><span aria-hidden="true">✓</span><div><strong>作者工作稿保持不变</strong><small>危险候选不会自动进入论文</small></div><b>已保护</b></li>
            </ul>
            <footer><span>自动应用权限</span><strong>0</strong></footer>
          </article>
        </div>
      </section>

      <section className="permission-section shell" aria-labelledby="permission-title">
        <div className="section-intro compact-intro">
          <span className="product-label">三层权限模型</span>
          <h2 id="permission-title">把生成、检查与决定分开</h2>
          <p>ScholarForge 不要求用户相信一个“更聪明的模型”，而是限制模型可以做什么。</p>
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
              <h2 id="workflow-title">四步完成一次可核对的审校</h2>
              <p>不需要学习复杂的 Agent 操作。每一步都明确告诉用户当前数据在哪里、下一步是什么。</p>
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
              <span className="preview-safe-state">安全门：已通过当前规则</span>
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
                <div><span>问题 01</span><strong>因果边界</strong><small>待处理</small></div>
                <div><span>问题 02</span><strong>结论强度</strong><small>已接受</small></div>
                <div><span>问题 03</span><strong>语言清晰度</strong><small>可安全应用</small></div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="boundary-section shell" aria-labelledby="boundary-title">
        <div>
          <span className="product-label">边界透明</span>
          <h2 id="boundary-title">安全门通过不等于论文科学正确</h2>
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
          <span className="product-label">无需安装或注册</span>
          <h2>打开公开案例，体验科研事实安全门</h2>
          <p>案例先载入浏览器草稿，只有你确认后才会发送分析。</p>
          <Link className="primary-link" href="/try">开始公开体验</Link>
        </div>
      </section>
    </main>
  );
}
