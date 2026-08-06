import type { SafetyGateReport } from '@/lib/types';

const STATE_LABELS = {
  passed: '通过',
  blocked: '已阻断',
  review: '需复核',
} as const;

const STATE_SYMBOLS = {
  passed: '✓',
  blocked: '!',
  review: '?',
} as const;

export function SafetyGatePanel({ report }: { report?: SafetyGateReport }) {
  if (!report) {
    return (
      <section className="safety-report safety-report-legacy safety-gate safety-gate-legacy" aria-labelledby="safety-gate-title">
        <header className="safety-report-header">
          <div className="safety-report-icon review" aria-hidden="true">?</div>
          <div><span className="product-label">科研事实安全门</span><h2 id="safety-gate-title">旧版结果需要重新分析</h2><p>原文和作者工作稿仍然保留。重新运行分析后可查看逐项安全证据。</p></div>
          <span className="safety-report-state review">需重新分析</span>
        </header>
      </section>
    );
  }

  const quarantined = report.status === 'quarantined';
  const passedCount = report.checks.filter((check) => check.state === 'passed').length;
  const reviewCount = report.checks.filter((check) => check.state === 'review').length;

  return (
    <section className={quarantined ? 'safety-report quarantined safety-gate safety-gate-quarantined' : 'safety-report passed safety-gate safety-gate-passed'} aria-labelledby="safety-gate-title">
      <header className="safety-report-header">
        <div className={quarantined ? 'safety-report-icon blocked' : 'safety-report-icon passed'} aria-hidden="true">{quarantined ? '!' : '✓'}</div>
        <div>
          <span className="product-label">ScholarForge Safety Gate</span>
          <h2 id="safety-gate-title">{quarantined ? '候选稿已隔离' : '候选稿通过当前自动规则'}</h2>
          <p>{quarantined
            ? `检测到 ${report.blockedCount} 项科研事实风险，作者工作稿未发生变化。`
            : '当前规则未发现需要阻断的问题，但这不等于论文科学正确，仍需作者逐条核对。'}</p>
        </div>
        <span className={quarantined ? 'safety-report-state blocked' : 'safety-report-state passed'}>{quarantined ? '禁止自动应用' : '允许进入作者核对'}</span>
      </header>

      <dl className="safety-report-metrics">
        <div><dt>检查项</dt><dd>{report.checks.length}</dd></div>
        <div><dt>通过</dt><dd>{passedCount}</dd></div>
        <div><dt>阻断</dt><dd>{report.blockedCount}</dd></div>
        <div><dt>需复核</dt><dd>{reviewCount}</dd></div>
        <div><dt>自动应用权限</dt><dd>{quarantined ? '0' : '逐条计算'}</dd></div>
      </dl>

      <div className="safety-check-list">
        {report.checks.map((check) => (
          <details className={`safety-check-row ${check.state}`} key={check.id} open={check.state === 'blocked'}>
            <summary>
              <span className="safety-check-symbol" aria-hidden="true">{STATE_SYMBOLS[check.state]}</span>
              <div><strong>{check.title}</strong><small>{check.summary}</small></div>
              <span className="safety-check-state">{STATE_LABELS[check.state]}</span>
            </summary>
            <div className="safety-check-evidence">
              <strong>检查证据</strong>
              {check.evidence.length ? <ul>{check.evidence.map((item) => <li key={item}>{item}</li>)}</ul> : <p>当前检查没有额外证据标记。</p>}
              <p><b>系统处理：</b>{check.state === 'blocked' ? '阻断自动应用，作者工作稿保持不变。' : check.state === 'review' ? '保留给作者进一步核对。' : '通过当前自动规则，仍需作者核对。'}</p>
            </div>
          </details>
        ))}
      </div>

      <footer className="safety-report-footer">
        <strong>权限边界</strong>
        <span>模型只提出候选；是否允许自动应用由代码独立计算，模型不能为自己声明“安全”。</span>
      </footer>
    </section>
  );
}
