import Link from 'next/link';
import { TASK_DESCRIPTIONS, TASK_LABELS } from '@/lib/config';
import type { TaskType } from '@/lib/types';

const tasks = Object.keys(TASK_LABELS) as TaskType[];

export default function Home() {
  return (
    <main id="main-content">
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Scientific writing, under author control</span>
            <h1>AI 提建议，<br />作者做决定。</h1>
            <p>ScholarForge 是科研英语检查与修改工作台：保留原文，逐条解释问题，只把作者确认的安全修改放进工作稿。</p>
            <div className="hero-actions"><Link className="primary-link" href="/workspace">开始新任务</Link><Link className="secondary-link" href="/history">恢复最近任务</Link></div>
            <div className="hero-trust"><span>原始文件不上传</span><span>未配置时不模拟</span><span>不批量应用建议</span></div>
          </div>
          <div className="hero-paper" aria-label="产品工作方式示意">
            <div className="paper-header"><span>Author workspace</span><span>Draft 01</span></div>
            <p className="paper-label">原文</p>
            <p>The results can well prove that the pore structure became much denser after curing.</p>
            <div className="paper-issue"><span>证据边界 · 一般问题</span><strong>“prove” 的结论强度可能超过现有证据。</strong><p>建议：The results indicate that…</p></div>
            <div aria-hidden="true" className="paper-decision"><span>拒绝</span><span>待定</span><span className="selected">接受并核对</span></div>
            <small>这条修改尚未进入作者工作稿。</small>
          </div>
        </div>
      </section>

      <section className="home-section shell" aria-labelledby="tasks-title">
        <div className="section-intro"><span className="eyebrow">三个可靠核心场景</span><h2 id="tasks-title">从一个明确任务开始</h2><p>不做通用聊天，不自动生成整篇论文，也不声称替代同行评议。</p></div>
        <div className="home-task-grid">
          {tasks.map((task, index) => <article key={task}><span>0{index + 1}</span><h3>{TASK_LABELS[task]}</h3><p>{TASK_DESCRIPTIONS[task]}</p><Link href="/workspace">开始{TASK_LABELS[task]}</Link></article>)}
        </div>
      </section>

      <section className="principles-section">
        <div className="shell principles-grid">
          <div><span className="eyebrow">开始前，你应当知道</span><h2>你的文本如何被处理</h2></div>
          <ol>
            <li><span>1</span><div><strong>输入保留在浏览器</strong><p>粘贴文本或在浏览器中提取 DOCX 正文。选择文件不会启动上传。</p></div></li>
            <li><span>2</span><div><strong>确认后才发送所选文本</strong><p>分析前会明确列出发送内容。未配置模型服务时按钮禁用，API 返回 503。</p></div></li>
            <li><span>3</span><div><strong>代码执行确定性检查</strong><p>检查数值、单位、术语锁、DOI、占位符和结构完整性；失败结果不会交给用户。</p></div></li>
            <li><span>4</span><div><strong>作者逐条决定</strong><p>原文、AI 建议稿和作者工作稿明确分开。每条修改可拒绝、待定、接受、应用和撤销。</p></div></li>
          </ol>
        </div>
      </section>

      <section className="responsibility-section shell">
        <div><span className="eyebrow">AI 的边界</span><h2>它能改善表达，不能替你确认科研事实。</h2></div>
        <p>所有数值、单位、样本数量、实验参数、统计结果、引用、方法、因果关系、期刊要求和结论强度都必须由作者最终核对。</p>
        <Link className="secondary-link" href="/settings">查看数据处理与当前限制</Link>
      </section>
    </main>
  );
}
