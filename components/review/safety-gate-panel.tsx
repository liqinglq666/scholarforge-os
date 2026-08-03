import type { SafetyGateReport } from '@/lib/types';

const STATE_LABELS = {
  passed: '通过',
  blocked: '已阻断',
  review: '需复核',
} as const;

export function SafetyGatePanel({ report }: { report?: SafetyGateReport }) {
  if (!report) {
    return (
      <section className="safety-gate safety-gate-legacy" aria-labelledby="safety-gate-title">
        <div className="safety-gate-heading">
          <div><span className="eyebrow">科研事实安全门</span><h2 id="safety-gate-title">旧版分析结果</h2></div>
          <span className="gate-status gate-review">需重新分析</span>
        </div>
        <p>这条历史结果生成于安全门报告上线之前。原文和作者工作稿仍然保留；重新运行分析后可查看逐项安全证据。</p>
      </section>
    );
  }

  const quarantined = report.status === 'quarantined';
  return (
    <section className={quarantined ? 'safety-gate safety-gate-quarantined' : 'safety-gate safety-gate-passed'} aria-labelledby="safety-gate-title">
      <div className="safety-gate-heading">
        <div>
          <span className="eyebrow">ScholarForge Safety Gate</span>
          <h2 id="safety-gate-title">科研事实安全门</h2>
          <p>{quarantined
            ? 'AI 候选稿违反了至少一项硬性规则，已与作者工作稿隔离。任何建议都不会自动进入论文。'
            : '候选稿已通过当前代码规则，但通过不等于科学正确，仍需作者逐条核对。'}</p>
        </div>
        <span className={quarantined ? 'gate-status gate-blocked' : 'gate-status gate-passed'}>
          {quarantined ? `已隔离 ${report.blockedCount} 项` : '安全门通过'}
        </span>
      </div>

      <div className="safety-check-grid">
        {report.checks.map((check) => (
          <article className={`safety-check safety-check-${check.state}`} key={check.id}>
            <div><strong>{check.title}</strong><span>{STATE_LABELS[check.state]}</span></div>
            <p>{check.summary}</p>
            {check.evidence.length ? <small>核对标记：{check.evidence.join(' · ')}</small> : null}
          </article>
        ))}
      </div>
      <div className="safety-gate-footnote">
        <strong>权限边界</strong>
        <span>模型只生成候选内容；是否允许自动应用由代码独立计算，模型无权自行声明“安全”。</span>
      </div>
    </section>
  );
}
