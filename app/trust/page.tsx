import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '安全与测试',
  description: '了解 ScholarForge 科研事实安全门的检查范围、工程边界、测试方法和已知限制。',
};

const checks = [
  ['数值与样本量', '比较原文与候选稿中的整数、小数、百分数和科学计数法，阻止静默增删或改写。'],
  ['数值与单位组合', '独立核对 MPa、mg/L、°C、时间和其他受支持单位，避免数字正确但单位被改变。'],
  ['引用与 DOI', '检查作者—年份引用和 DOI 是否被新增、删除或替换。'],
  ['术语规则', '作者指定的材料名、量表、算法和缩写必须按明确规则呈现。'],
  ['新增实验声明', '候选稿不得声称实施原文未提供的新实验、补充实验或方法步骤。'],
  ['因果关系', '检测相关、关联或预测关系是否被升级为 cause、lead to、导致等因果表述。'],
  ['结论强度', '检测 may、suggest、indicate 等审慎表达是否被升级为 prove、confirm、完全等确定性表达。'],
  ['研究范围', '检测有限样本、单中心或横断面研究是否被扩大为所有人群、全国或普遍结论。'],
];

export default function TrustPage() {
  return (
    <main className="shell page-main trust-page" id="main-content">
      <section className="trust-hero">
        <span className="eyebrow">Trust through visible boundaries</span>
        <h1>安全能力必须可解释，也必须承认边界</h1>
        <p>ScholarForge 不要求用户相信一个“更聪明的模型”。它把模型候选交给独立代码检查，并公开展示检查项、证据、阻断原因和当前未覆盖范围。</p>
        <div className="competition-actions">
          <Link className="primary-link" href="/try">运行公开体验</Link>
          <a className="secondary-link" href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">查看源代码</a>
        </div>
      </section>

      <section className="trust-grid" aria-label="科研事实安全门检查范围">
        {checks.map(([title, description], index) => (
          <article key={title}><span className="eyebrow">CHECK 0{index + 1}</span><h2>{title}</h2><p>{description}</p></article>
        ))}
      </section>

      <section className="trust-limitations" aria-labelledby="limitations-title">
        <span className="eyebrow">Known limitations</span>
        <h2 id="limitations-title">安全门通过不等于论文科学正确</h2>
        <p>当前系统不能验证原始数据真实性、统计分析正确性、参考文献内容、伦理合规、期刊最新规则或实验能否复现。规则检测也可能出现漏报和误报。作者仍需核对事实，并在必要时咨询导师、统计专家、伦理机构和期刊编辑。</p>
      </section>

      <section className="competition-section" aria-labelledby="testing-title">
        <div className="competition-section-heading">
          <div><span className="eyebrow">测试方法</span><h2 id="testing-title">把安全承诺写成可重复执行的测试</h2></div>
          <p>仓库使用单元、API、组件和端到端测试覆盖请求校验、模型异常、确定性检查、安全应用、撤销恢复、DOCX、备份、移动端和服务未配置状态。新增安全规则会配套回归用例，避免只停留在产品文案。</p>
        </div>
        <div className="competition-feature-grid">
          <article><span>UNIT</span><h3>确定性规则测试</h3><p>为数字、单位、引用、因果、结论强度和研究范围准备成对文本，验证阻断结果。</p></article>
          <article><span>API</span><h3>不可信模型输出</h3><p>覆盖非 JSON、截断、空结果、重复 ID、超长字段和供应商错误。</p></article>
          <article><span>WORKFLOW</span><h3>作者控制闭环</h3><p>验证安全应用、拒绝、撤回、撤销、重做、导出和历史恢复。</p></article>
          <article><span>E2E</span><h3>公网体验路径</h3><p>验证桌面和移动端首次访问、公开案例、分析、结果页和无横向滚动。</p></article>
        </div>
      </section>
    </main>
  );
}
