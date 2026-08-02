import Link from 'next/link';
import { ExampleShowcase } from '@/components/home/example-showcase';

const layers = [
  {
    number: '01',
    title: 'AI 生成候选',
    description: '百炼模型根据明确任务生成完整候选稿和逐条问题，但无权直接改写作者工作稿。',
    items: ['科研中译英', '英文保守润色', '投稿前检查'],
  },
  {
    number: '02',
    title: '代码执行安全门',
    description: '模型输出必须经过独立代码检查；违反科研事实硬规则时，候选稿会被隔离。',
    items: ['数值与单位', '引用与 DOI', '因果与结论边界'],
  },
  {
    number: '03',
    title: '作者逐条决定',
    description: '只有可唯一定位且不改变科学含义的局部建议，才可能获得自动应用资格。',
    items: ['接受或拒绝', '撤销与重做', '作者稿导出'],
  },
];

const features = [
  {
    label: 'DETERMINISTIC',
    title: '模型不能给自己颁发安全许可',
    description: 'safeToApply 由代码重新计算。模型只能提出候选，不能决定某条修改是否可以进入作者工作稿。',
  },
  {
    label: 'QUARANTINE',
    title: '危险候选不会变成一次普通报错',
    description: '若数字、单位、引用或主张边界发生变化，系统保留原文并展示隔离证据，让作者看见 AI 哪里出了问题。',
  },
  {
    label: 'ANCHORING',
    title: '每条修改都要重新定位',
    description: '应用前检查原文是否仍然唯一存在，避免在文本已变化后把建议错贴到其他位置。',
  },
  {
    label: 'LOCAL FIRST',
    title: '论文项目默认保存在浏览器',
    description: '原始 DOCX 不上传；只有作者确认分析后，当前选择的文本与设置才会发送到模型服务。',
  },
];

export default function Home() {
  return (
    <main id="main-content">
      <section className="competition-hero">
        <div className="shell competition-hero-grid">
          <div className="competition-copy">
            <div className="competition-kicker">
              <span>Scientific Fact Safety</span>
              <span>Author-controlled AI</span>
              <span>Built with Alibaba Cloud Model Studio</span>
            </div>
            <h1>普通 AI 帮你改论文，<span>ScholarForge 阻止 AI 改错论文。</span></h1>
            <p>为科研论文增加一道独立安全门。代码检查数值、单位、引用、术语、因果关系、结论强度和研究范围；AI 只提建议，最终文本始终由作者决定。</p>
            <div className="competition-actions">
              <Link className="primary-link" href="/try">立即体验科研事实安全审校</Link>
              <Link className="secondary-link" href="/projects">进入完整论文工作台</Link>
            </div>
            <div className="competition-note">
              <span>无需登录</span>
              <span>无需配置 API Key</span>
              <span>示例使用真实模型分析</span>
            </div>
          </div>

          <div className="risk-console" aria-label="科研事实安全门示意">
            <div className="risk-console-top"><span>ScholarForge Safety Gate</span><div aria-hidden="true"><i /><i /><i /></div></div>
            <div className="risk-console-body">
              <div className="risk-fragment">
                <span>原文</span>
                <p>Participants who slept less than 6 h had higher anxiety scores. The cross-sectional design could not establish temporal ordering.</p>
              </div>
              <div className="risk-fragment danger">
                <span>危险候选</span>
                <p>Short sleep <del>causes</del> anxiety in <del>all university students</del>.</p>
              </div>
              <ul className="risk-findings">
                <li><span>相关关系被升级为因果关系</span><b>Blocked</b></li>
                <li><span>有限样本被扩大为普遍结论</span><b>Blocked</b></li>
                <li><span>作者工作稿保持原文</span><b>Protected</b></li>
              </ul>
              <div className="risk-console-result"><strong>候选稿已隔离</strong><span>自动应用权限：0</span></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="产品核心能力" className="competition-proof shell">
        <article><strong>模型与权限分离</strong><span>AI 负责提出候选，代码负责安全许可，作者负责最终决定。</span></article>
        <article><strong>科研事实硬规则</strong><span>保护数字、单位、引用、实验声明与证据边界。</span></article>
        <article><strong>完整作者闭环</strong><span>逐条核对、接受、拒绝、撤回、版本记录和导出。</span></article>
        <article><strong>公网直接体验</strong><span>无需下载、无需部署、无需评委配置模型密钥。</span></article>
      </section>

      <section className="competition-section shell" aria-labelledby="architecture-title">
        <div className="competition-section-heading">
          <div><span className="eyebrow">不是另一个论文聊天框</span><h2 id="architecture-title">把 AI 修改本身变成被审查的对象</h2></div>
          <p>大多数写作工具关注“生成得更好”。ScholarForge 关注一个更基础的问题：模型提出的修改，是否仍然忠实于原始科研事实？</p>
        </div>
        <div className="safety-architecture">
          {layers.map((layer) => (
            <article className="safety-layer" key={layer.number}>
              <span>{layer.number}</span>
              <h3>{layer.title}</h3>
              <p>{layer.description}</p>
              <ul>{layer.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="competition-section tinted" aria-labelledby="features-title">
        <div className="shell">
          <div className="competition-section-heading">
            <div><span className="eyebrow">可验证的工程能力</span><h2 id="features-title">技术难度不藏在代码仓库里</h2></div>
            <p>每次分析都会把安全门结果展示给用户。评委可以直接看到哪些规则通过、哪些风险被阻断，以及为何某条建议不能自动应用。</p>
          </div>
          <div className="competition-feature-grid">
            {features.map((feature) => (
              <article key={feature.label}><span>{feature.label}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="competition-section shell" aria-labelledby="experience-title">
        <div className="judge-path">
          <div className="judge-path-copy">
            <span className="eyebrow">评委可独立完成</span>
            <h2 id="experience-title">四步体验真实核心功能</h2>
            <p>不需要注册账号，也不需要阅读复杂部署说明。推荐案例会填入公开科研文本，由评委主动确认后调用真实模型。</p>
            <div className="competition-actions">
              <Link className="primary-link" href="/try">查看推荐体验路径</Link>
              <Link className="secondary-link" href="/guide">阅读使用手册</Link>
            </div>
          </div>
          <ol className="judge-steps">
            <li><div><strong>打开公开案例</strong><span>选择包含因果边界问题的生命医学讨论段。</span></div></li>
            <li><div><strong>运行真实 AI 审校</strong><span>确认发送内容后，调用服务端配置的百炼模型。</span></div></li>
            <li><div><strong>查看安全门证据</strong><span>逐项查看数字、单位、引用和主张边界检查。</span></div></li>
            <li><div><strong>形成作者工作稿</strong><span>只应用代码允许的局部建议，并体验撤销和导出。</span></div></li>
          </ol>
        </div>
      </section>

      <section className="competition-section tinted" aria-labelledby="examples-title">
        <div className="shell">
          <div className="competition-section-heading">
            <div><span className="eyebrow">跨学科真实场景</span><h2 id="examples-title">同一套安全原则，覆盖不同研究语言</h2></div>
            <p>材料、生命医学、计算机、社会科学、环境与教育案例覆盖数值保护、因果边界、实验可复现性和研究范围外推。</p>
          </div>
          <ExampleShowcase />
        </div>
      </section>

      <section className="competition-section shell" aria-labelledby="trust-title">
        <div className="competition-section-heading">
          <div><span className="eyebrow">边界透明</span><h2 id="trust-title">安全门降低风险，但不冒充科学正确性验证</h2></div>
          <p>系统不会声称替代作者、导师、统计专家、伦理审查、同行评议或期刊编辑。所有未覆盖风险和当前限制都公开展示。</p>
        </div>
        <div className="competition-actions">
          <Link className="primary-link" href="/trust">查看安全规则与测试方法</Link>
          <Link className="secondary-link" href="/settings">查看数据与隐私边界</Link>
        </div>
      </section>
    </main>
  );
}
