import Link from 'next/link';
import { ExampleShowcase } from '@/components/home/example-showcase';
import { TASK_DESCRIPTIONS, TASK_LABELS } from '@/lib/config';
import type { TaskType } from '@/lib/types';

const tasks = Object.keys(TASK_LABELS) as TaskType[];

const projectSteps = [
  {
    number: '01',
    title: '建立论文项目',
    description: '把章节、目标期刊和术语规则放进同一个本地项目，先建立稳定的写作上下文。',
    href: '/projects',
    linkLabel: '创建本地项目',
  },
  {
    number: '02',
    title: '选择一个章节审校',
    description: '每次只处理作者明确选择的内容，未选章节不会随页面打开而发送。',
    href: '/projects',
    linkLabel: '选择项目章节',
  },
  {
    number: '03',
    title: '逐条决定并回写',
    description: '接受、保留或稍后处理每条建议，确认后再把作者稿保存回论文项目。',
    href: '/projects',
    linkLabel: '查看项目工作流',
  },
];

export default function Home() {
  return (
    <main id="main-content">
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="hero-signal">
              <span className="eyebrow">Scientific writing, under author control</span>
              <span className="product-badge">本地优先 · 可恢复 · 可核对</span>
            </div>
            <h1>AI 提建议，<br />作者做决定。</h1>
            <p>ScholarForge 把论文项目、多个章节、共享术语和逐条审校放在一个清晰工作流中。它帮助你改善表达，但不会替你编写整篇论文或确认科研事实。</p>
            <div className="hero-actions">
              <Link className="primary-link" href="/projects">创建论文项目</Link>
              <Link className="secondary-link" href="/workspace">单段落审校</Link>
            </div>
            <ol aria-label="核心使用流程" className="hero-flow">
              <li><span>1</span><strong>准备章节</strong></li>
              <li><span>2</span><strong>查看建议</strong></li>
              <li><span>3</span><strong>作者确认</strong></li>
            </ol>
            <div className="hero-trust">
              <span>未选章节不上传</span>
              <span>一致性检查在本地运行</span>
              <span>建议不会批量自动应用</span>
            </div>
          </div>
          <ExampleShowcase />
        </div>
      </section>

      <section aria-label="产品关键能力" className="home-proof shell">
        <article><strong>最多 12 个章节</strong><span>统一管理摘要、方法、结果、讨论等论文结构。</span></article>
        <article><strong>3 类可靠任务</strong><span>科研中译英、英文保守润色和投稿前检查。</span></article>
        <article><strong>逐条作者决策</strong><span>每个建议都可核对、应用、撤回并保留记录。</span></article>
      </section>

      <section className="home-section shell" aria-labelledby="project-title">
        <div className="section-intro section-intro-wide">
          <div>
            <span className="eyebrow">面向整篇论文的工作方式</span>
            <h2 id="project-title">从论文结构开始，而不是从一个空白聊天框开始</h2>
          </div>
          <p>目标期刊、章节结构和术语规则先形成项目上下文；需要 AI 时，再为当前章节选择一次明确任务。</p>
        </div>
        <div className="home-task-grid project-step-grid">
          {projectSteps.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <Link href={step.href}>{step.linkLabel}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section-tinted" aria-labelledby="tasks-title">
        <div className="shell">
          <div className="section-intro section-intro-wide">
            <div>
              <span className="eyebrow">三个可靠核心任务</span>
              <h2 id="tasks-title">每次只解决一个明确问题</h2>
            </div>
            <p>任务边界保持清晰：不做通用聊天，不自动生成整篇论文，也不声称替代同行评议或期刊编辑判断。</p>
          </div>
          <div className="home-task-grid task-entry-grid">
            {tasks.map((task, index) => (
              <article key={task}>
                <span>0{index + 1}</span>
                <h3>{TASK_LABELS[task]}</h3>
                <p>{TASK_DESCRIPTIONS[task]}</p>
                <Link href={`/workspace?task=${task}`}>开始{TASK_LABELS[task]}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="principles-section">
        <div className="shell principles-grid">
          <div className="principles-heading">
            <span className="eyebrow">开始前，你应当知道</span>
            <h2>你的文本如何被处理</h2>
            <p>每个阶段都明确区分本地数据、发送内容、代码检查和作者决定。</p>
          </div>
          <ol>
            <li><span>1</span><div><strong>项目和章节保留在浏览器</strong><p>论文项目、术语库和未选章节不会因为打开页面而上传。</p></div></li>
            <li><span>2</span><div><strong>确认后才发送当前章节</strong><p>分析前会列出发送内容；模型服务未配置时不会伪造分析结果。</p></div></li>
            <li><span>3</span><div><strong>代码执行确定性检查</strong><p>检查数值、单位、术语锁、DOI、占位符和跨章节一致性候选。</p></div></li>
            <li><span>4</span><div><strong>作者逐条决定并明确回写</strong><p>项目稿、AI 建议稿和作者工作稿保持分离，不会静默覆盖。</p></div></li>
          </ol>
        </div>
      </section>

      <section className="responsibility-section shell">
        <div>
          <span className="eyebrow">AI 的边界</span>
          <h2>改善表达，不替你确认事实。</h2>
        </div>
        <div className="responsibility-copy">
          <p>所有数值、单位、样本数量、实验参数、统计结果、引用、方法、因果关系、期刊要求和结论强度都必须由作者最终核对。</p>
          <div className="responsibility-actions">
            <Link className="primary-link" href="/projects">开始建立论文项目</Link>
            <Link className="secondary-link" href="/settings">查看数据处理与限制</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
