import Link from 'next/link';
import { ExampleShowcase } from '@/components/home/example-showcase';
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
            <p>ScholarForge 把论文项目、多个章节、共享术语库和逐条审校放在一个本地工作区中；不自动生成整篇论文，也不替作者确认科研事实。</p>
            <div className="hero-actions"><Link className="primary-link" href="/project">创建论文项目</Link><Link className="secondary-link" href="/workspace">单段落审校</Link></div>
            <div className="hero-trust"><span>其他章节不上传</span><span>一致性检查在本地运行</span><span>不批量应用建议</span></div>
          </div>
          <ExampleShowcase />
        </div>
      </section>

      <section className="home-section shell" aria-labelledby="project-title">
        <div className="section-intro"><span className="eyebrow">面向整篇论文的工作方式</span><h2 id="project-title">先建立项目，再逐章处理</h2><p>摘要、方法、结果、讨论和结论共享目标期刊与术语库；每次只把作者明确选择的一个章节送入审校工作台。</p></div>
        <div className="home-task-grid">
          <article><span>01</span><h3>多章节论文项目</h3><p>在当前浏览器中管理最多 12 个章节，记录每章任务、正文和最近回写状态。</p><Link href="/project">创建本地项目</Link></article>
          <article><span>02</span><h3>跨章节一致性</h3><p>本地检查样本量候选、带单位指标、缩写定义和指定术语，展示冲突位置但不自动替换。</p><Link href="/project">运行一致性检查</Link></article>
          <article><span>03</span><h3>逐章审校与回写</h3><p>章节进入现有工作台后，作者逐条决定、应用和撤回，完成后再明确保存回论文项目。</p><Link href="/workspace">打开审校工作台</Link></article>
        </div>
      </section>

      <section className="home-section shell" aria-labelledby="tasks-title">
        <div className="section-intro"><span className="eyebrow">三个可靠核心任务</span><h2 id="tasks-title">每次仍然只解决一个明确问题</h2><p>项目管理不会改变审校边界：不做通用聊天，不自动生成整篇论文，也不声称替代同行评议。</p></div>
        <div className="home-task-grid">
          {tasks.map((task, index) => <article key={task}><span>0{index + 1}</span><h3>{TASK_LABELS[task]}</h3><p>{TASK_DESCRIPTIONS[task]}</p><Link href={`/workspace?task=${task}`}>开始{TASK_LABELS[task]}</Link></article>)}
        </div>
      </section>

      <section className="principles-section">
        <div className="shell principles-grid">
          <div><span className="eyebrow">开始前，你应当知道</span><h2>你的文本如何被处理</h2></div>
          <ol>
            <li><span>1</span><div><strong>项目和章节保留在浏览器</strong><p>论文项目、术语库和未选章节不会因为打开页面而上传。</p></div></li>
            <li><span>2</span><div><strong>确认后才发送当前章节</strong><p>分析前会明确列出发送内容。未配置模型服务时按钮禁用，API 返回 503。</p></div></li>
            <li><span>3</span><div><strong>代码执行确定性检查</strong><p>检查数值、单位、术语锁、DOI、占位符和结构完整性；跨章节检查直接在浏览器中运行。</p></div></li>
            <li><span>4</span><div><strong>作者逐条决定并明确回写</strong><p>项目章节、AI 建议稿和作者工作稿明确分开，工作台修改不会静默覆盖项目稿。</p></div></li>
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
