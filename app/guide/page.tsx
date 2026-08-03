import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '使用手册',
  description: 'ScholarForge OS 公网体验、核心流程、数据处理、安全边界和完整论文工作台使用说明。',
};

const steps = [
  ['打开推荐案例', '进入“直接体验”，载入生命医学讨论段。案例只会填入当前浏览器草稿，不会自动发送。'],
  ['选择任务并确认发送', '推荐使用“投稿前检查”。点击开始后，确认本次发送的文本、章节类型、写作语境和术语规则。'],
  ['查看科研事实安全门', '分析完成后先看安全门。若候选稿违反硬规则，会显示“已隔离”，作者工作稿保持不变。'],
  ['逐条处理建议', '查看原文证据、候选修改和理由，选择接受、拒绝或暂缓。不能安全定位的建议只能手动处理。'],
  ['导出作者确认版本', '完成核对后，可导出作者工作稿 TXT、审校报告 Markdown 或清洁 DOCX。'],
];

export default function GuidePage() {
  return (
    <main className="shell page-main guide-page" id="main-content">
      <section className="guide-hero">
        <span className="eyebrow">评委与用户手册</span>
        <h1>打开网页即可完成核心体验</h1>
        <p>ScholarForge 是公网可运行的 Web 应用。评委不需要下载程序、拉取代码、配置依赖或填写 API Key。推荐从公开案例开始，再按需体验完整论文项目。</p>
        <div className="competition-actions">
          <Link className="primary-link" href="/try">开始推荐体验</Link>
          <Link className="secondary-link" href="/projects">进入完整工作台</Link>
        </div>
      </section>

      <section className="guide-facts" aria-label="使用条件">
        <article><strong>账号</strong><span>非必需，游客模式支持完整核心流程</span></article>
        <article><strong>模型密钥</strong><span>服务端配置，用户无需提供</span></article>
        <article><strong>推荐入口</strong><span>/try 公开案例体验</span></article>
      </section>

      <section className="guide-quickstart" aria-label="快速体验步骤">
        {steps.map(([title, description], index) => (
          <article key={title}><b>{index + 1}</b><div><h2>{title}</h2><p>{description}</p></div></article>
        ))}
      </section>

      <section className="competition-section" aria-labelledby="full-workflow-title">
        <div className="competition-section-heading">
          <div><span className="eyebrow">完整产品能力</span><h2 id="full-workflow-title">从单段落审校扩展到整篇论文</h2></div>
          <p>论文项目可以管理多个章节、共享术语、导师意见和版本记录。每次只把作者明确选择的章节送入审校，其他章节仍保存在浏览器。</p>
        </div>
        <div className="competition-feature-grid">
          <article><span>论文项目</span><h3>多项目与多章节</h3><p>每篇论文拥有独立章节、目标期刊、术语、意见和版本上下文。</p></article>
          <article><span>一致性检查</span><h3>跨章节核对</h3><p>在浏览器中检查样本量候选、带单位指标、缩写和项目术语。</p></article>
          <article><span>导师意见</span><h3>处理与回复记录</h3><p>拆分、关联、追踪意见，记录作者回复并导出修改说明。</p></article>
          <article><span>恢复能力</span><h3>版本与备份</h3><p>支持撤销、重做、历史任务、版本比较和完整 JSON 工作区备份。</p></article>
        </div>
      </section>

      <section className="trust-limitations" aria-labelledby="guide-data-title">
        <span className="eyebrow">数据边界</span>
        <h2 id="guide-data-title">论文正文默认保存在当前浏览器</h2>
        <p>DOCX 在浏览器中提取正文，原始二进制文件不上传。只有用户明确开始分析后，当前文本和设置才会发送到服务端与模型。可选账户只同步个性化偏好，不自动同步论文正文、导师意见、版本全文或分析历史。</p>
      </section>
    </main>
  );
}
