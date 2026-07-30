'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { SAMPLE_MANUSCRIPT } from '@/lib/demo-review';
import type { AgentId, ReviewIssue, ReviewResult } from '@/lib/types';

const AGENTS: Array<{
  id: AgentId;
  icon: string;
  name: string;
  role: string;
}> = [
  { id: 'terminology', icon: 'T', name: 'Terminology Guardian', role: '术语与缩写一致性' },
  { id: 'language', icon: 'A', name: 'Academic Editor', role: '语法与学术表达' },
  { id: 'logic', icon: 'L', name: 'Logic Auditor', role: '论证与因果边界' },
  { id: 'method', icon: 'M', name: 'Method Auditor', role: '方法完整性与复现' },
];

const AGENT_LABELS: Record<AgentId, string> = {
  terminology: '术语 Agent',
  language: '语言 Agent',
  logic: '逻辑 Agent',
  method: '方法 Agent',
};

type ResultTab = 'comparison' | 'issues' | 'terms' | 'trace';

type ReviewPayload = ReviewResult & {
  error?: string;
  detail?: string;
  requestId?: string;
};

function decisionLabel(decision?: ReviewResult['decision']) {
  if (decision === 'ready') return 'Ready for Submission';
  if (decision === 'minor_revision') return 'Minor Revision';
  if (decision === 'major_revision') return 'Major Revision';
  return 'Awaiting Review';
}

function severityLabel(severity: ReviewIssue['severity']) {
  if (severity === 'major') return 'Major';
  if (severity === 'minor') return 'Minor';
  return 'Suggestion';
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(1)} s`;
}

function safeFileStem(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'scholarforge-review';
}

function buildMarkdownReport(result: ReviewResult, source: string, targetJournal: string) {
  const issueLines = result.issues.map((issue, index) => [
    `### ${index + 1}. ${issue.category} · ${severityLabel(issue.severity)}`,
    `- Agent: ${AGENT_LABELS[issue.agent]}`,
    `- Location: ${issue.location}`,
    `- Original: ${issue.original || 'Not supplied'}`,
    `- Suggested revision: ${issue.revised || 'Author action required'}`,
    `- Reason: ${issue.reason}`,
    `- Scientific meaning changed: ${issue.meaningChanged ? 'Yes' : 'No'}`,
  ].join('\n')).join('\n\n');

  const termLines = result.terminology.length
    ? result.terminology.map((term) => [
        `- **${term.preferred}**`,
        term.avoid.length ? `  - Avoid: ${term.avoid.join(', ')}` : '',
        `  - Note: ${term.note}`,
      ].filter(Boolean).join('\n')).join('\n')
    : '- No terminology rule was generated for this passage.';

  const traceLines = result.agentRuns.map((run) =>
    `- ${AGENT_LABELS[run.agent]}: ${run.status}, ${formatDuration(run.durationMs)}, ${run.issueCount} issues, model=${run.model}`,
  ).join('\n');

  return `# ScholarForge OS Academic English Review\n\n` +
    `- Target journal: ${targetJournal || 'Not specified'}\n` +
    `- Generated at: ${result.generatedAt}\n` +
    `- Workflow: ${result.workflowVersion} (${result.executionMode})\n` +
    `- Decision: ${decisionLabel(result.decision)}\n` +
    `- Score: ${result.scoreBefore} → ${result.scoreAfter}\n\n` +
    `## Executive summary\n\n${result.summary}\n\n` +
    `## Decision rationale\n\n${result.decisionReason}\n\n` +
    `## Agent execution trace\n\n${traceLines}\n\n` +
    `## Issues\n\n${issueLines || 'No issue was returned.'}\n\n` +
    `## Terminology glossary\n\n${termLines}\n\n` +
    `## Original manuscript\n\n${source}\n\n` +
    `## ScholarForge revision\n\n${result.revisedText}\n`;
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [text, setText] = useState(SAMPLE_MANUSCRIPT);
  const [targetJournal, setTargetJournal] = useState('Construction and Building Materials');
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('comparison');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 120);
    return () => window.clearInterval(timer);
  }, [loading]);

  const majorIssues = useMemo(
    () => result?.issues.filter((issue) => issue.severity === 'major').length ?? 0,
    [result],
  );

  const failedAgents = useMemo(
    () => result?.agentRuns.filter((run) => run.status === 'failed').length ?? 0,
    [result],
  );

  const progress = loading
    ? Math.min(92, 18 + elapsedMs / 520)
    : result
      ? 100
      : 0;

  async function handleReview() {
    if (loading) return;
    setLoading(true);
    setElapsedMs(0);
    setError('');
    setResult(null);
    setActiveTab('comparison');

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetJournal }),
      });
      const payload = await response.json() as ReviewPayload;

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'Review request failed.');
      }

      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '审校失败，请检查配置后重试。');
    } finally {
      setLoading(false);
    }
  }

  async function copyRevision() {
    if (!result?.revisedText) return;
    await navigator.clipboard.writeText(result.revisedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_400);
  }

  function downloadArtifact(kind: 'revision' | 'report' | 'json') {
    if (!result) return;
    const stem = safeFileStem(targetJournal);

    if (kind === 'revision') {
      downloadText(`${stem}-revised.txt`, result.revisedText, 'text/plain;charset=utf-8');
      return;
    }

    if (kind === 'report') {
      downloadText(
        `${stem}-audit-report.md`,
        buildMarkdownReport(result, text, targetJournal),
        'text/markdown;charset=utf-8',
      );
      return;
    }

    downloadText(
      `${stem}-review-result.json`,
      JSON.stringify({ targetJournal, sourceText: text, ...result }, null, 2),
      'application/json;charset=utf-8',
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-title">ScholarForge OS｜研语工坊</div>
            <div className="brand-subtitle">Evidence-aware academic writing workspace</div>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="status-chip"><span className="status-dot" /> Model Studio connected</div>
          <span className="small-chip">MVP · v0.2</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="panel side-panel left-panel">
          <section className="panel-section">
            <div className="eyebrow">Current project</div>
            <h2 className="section-title">论文项目空间</h2>
            <p className="section-copy">每次审校围绕同一段科研文本生成问题、术语、执行轨迹和可下载交付物。</p>
            <div className="project-card">
              <div className="project-card-label">Active review</div>
              <h3>{targetJournal || 'Untitled journal review'}</h3>
              <p>Workflow v0.2 · Parallel specialists</p>
            </div>
          </section>

          <section className="panel-section">
            <div className="eyebrow">Agent team</div>
            <div className="parallel-note">4 次独立百炼调用并行执行</div>
            <div className="agent-list">
              {AGENTS.map((agent) => {
                const run = result?.agentRuns.find((item) => item.agent === agent.id);
                const done = run?.status === 'completed' || run?.status === 'demo';
                const failed = run?.status === 'failed';
                const running = loading;
                return (
                  <div
                    className={`agent-row ${done ? 'is-done' : ''} ${running ? 'is-running' : ''} ${failed ? 'is-failed' : ''}`}
                    key={agent.id}
                  >
                    <div className="agent-icon">{done ? '✓' : failed ? '!' : agent.icon}</div>
                    <div>
                      <div className="agent-name">{agent.name}</div>
                      <div className="agent-role">{agent.role}</div>
                    </div>
                    <div className="agent-state">
                      {done ? formatDuration(run.durationMs) : failed ? '失败' : running ? '并行运行' : '等待'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel-section">
            <div className="eyebrow">Scientific guardrails</div>
            <div className="guardrail-list">
              {(result?.guardrails || [
                { id: 'numbers', label: '不新增原文没有的数值和试验结果', passed: true },
                { id: 'meaning', label: '不把语言润色伪装成科学结论修改', passed: true },
                { id: 'missing-info', label: '缺失信息保留为作者待补项', passed: true },
              ]).map((guardrail) => (
                <div className={`guardrail ${guardrail.passed ? '' : 'is-warning'}`} key={guardrail.id}>
                  <b>{guardrail.passed ? '✓' : '!'}</b><span>{guardrail.label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="panel main-panel">
          <div className="hero">
            <div className="hero-head">
              <div>
                <div className="eyebrow">Parallel multi-agent manuscript review</div>
                <h1>让每一次科研英语修改<br />都有<em>依据</em>。</h1>
                <p>四个独立专业 Agent 并行完成术语、语言、逻辑和方法审查；代码统一聚合问题、校准评分，并保留科学意义保护规则。</p>
              </div>
              <div className="hero-seal">SCIENTIFIC<br />MEANING<br />PROTECTED</div>
            </div>
          </div>

          <div className="editor-zone">
            <div className="editor-toolbar">
              <label className="field-label" htmlFor="journal">目标期刊与审校文本</label>
              <span className="counter">{text.length.toLocaleString()} / 12,000</span>
            </div>
            <input
              id="journal"
              className="journal-input"
              value={targetJournal}
              onChange={(event) => setTargetJournal(event.target.value)}
              placeholder="Target journal (optional)"
            />
            <textarea
              className="manuscript-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste an English manuscript passage here..."
              spellCheck={false}
            />
            <div className="action-row">
              <button className="text-button" onClick={() => setText(SAMPLE_MANUSCRIPT)} type="button">
                ↺ 恢复示例论文
              </button>
              <button
                className="primary-button"
                disabled={loading || text.trim().length < 40 || text.length > 12_000}
                onClick={handleReview}
                type="button"
              >
                {loading ? '四个 Agent 正在并行审校…' : '启动全面审校 →'}
              </button>
            </div>
            {error ? <div className="error-box">{error}</div> : null}
          </div>

          {(loading || result) ? (
            <div className="progress-strip">
              <div className="progress-track">
                <div className="progress-value" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-copy">
                <span>{loading ? `并行调用百炼 · 已等待 ${(elapsedMs / 1_000).toFixed(1)} s` : `工作流 ${result?.workflowVersion} 已完成`}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="result-area">
              <div className="tabs">
                <button className={`tab ${activeTab === 'comparison' ? 'is-active' : ''}`} onClick={() => setActiveTab('comparison')}>对照审校</button>
                <button className={`tab ${activeTab === 'issues' ? 'is-active' : ''}`} onClick={() => setActiveTab('issues')}>问题中心 · {result.issues.length}</button>
                <button className={`tab ${activeTab === 'terms' ? 'is-active' : ''}`} onClick={() => setActiveTab('terms')}>术语库 · {result.terminology.length}</button>
                <button className={`tab ${activeTab === 'trace' ? 'is-active' : ''}`} onClick={() => setActiveTab('trace')}>运行轨迹 · {result.agentRuns.length}</button>
              </div>

              <div className="result-content">
                <div className="result-toolbar">
                  <span className={`mode-chip ${result.mode === 'live' ? 'live' : ''}`}>
                    <span className="status-dot" />
                    {result.mode === 'live' ? '百炼真实多 Agent' : '安全演示模式'}
                  </span>
                  {activeTab === 'comparison' ? (
                    <button className="copy-button" onClick={copyRevision}>{copied ? '已复制 ✓' : '复制修改稿'}</button>
                  ) : null}
                </div>

                {activeTab === 'comparison' ? (
                  <div className="comparison-grid">
                    <article className="text-paper">
                      <div className="paper-label">Original manuscript</div>
                      <p>{text}</p>
                    </article>
                    <article className="text-paper revised">
                      <div className="paper-label">ScholarForge conservative revision</div>
                      <p>{result.revisedText}</p>
                    </article>
                  </div>
                ) : null}

                {activeTab === 'issues' ? (
                  <div className="issue-list">
                    {result.issues.map((issue) => (
                      <article className={`issue-card ${issue.severity}`} key={issue.id}>
                        <div className="issue-meta">
                          <span className="small-chip">{AGENT_LABELS[issue.agent]}</span>
                          <span className="small-chip">{severityLabel(issue.severity)}</span>
                          <span className="issue-location">{issue.location}</span>
                        </div>
                        <h3 className="issue-title">{issue.category}</h3>
                        <div className="issue-change">
                          <div className="quote-box">{issue.original || 'No original excerpt supplied.'}</div>
                          <div className="quote-box after">{issue.revised || 'Author action required.'}</div>
                        </div>
                        <p className="issue-reason">{issue.reason}</p>
                      </article>
                    ))}
                  </div>
                ) : null}

                {activeTab === 'terms' ? (
                  <div className="term-list">
                    {result.terminology.length ? result.terminology.map((term) => (
                      <article className="term-card" key={term.preferred}>
                        <h4>{term.preferred}</h4>
                        {term.avoid.length ? <div className="term-avoid">避免混用：{term.avoid.join(' · ')}</div> : null}
                        <p className="term-note">{term.note}</p>
                      </article>
                    )) : <div className="empty-result">本段未发现需要建立的术语规则。</div>}
                  </div>
                ) : null}

                {activeTab === 'trace' ? (
                  <div className="trace-list">
                    {result.agentRuns.map((run) => (
                      <article className={`trace-card ${run.status}`} key={run.agent}>
                        <div className="trace-head">
                          <div>
                            <div className="trace-name">{AGENT_LABELS[run.agent]}</div>
                            <div className="trace-model">{run.model}</div>
                          </div>
                          <span className="small-chip">{run.status}</span>
                        </div>
                        <p>{run.summary}</p>
                        <div className="trace-metrics">
                          <span>耗时 <strong>{formatDuration(run.durationMs)}</strong></span>
                          <span>问题 <strong>{run.issueCount}</strong></span>
                        </div>
                        {run.error ? <div className="trace-error">{run.error}</div> : null}
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="empty-result">
              <div className="empty-icon">⌁</div>
              <div>启动审校后，这里会显示原文对照、问题证据、术语规则和真实 Agent 运行轨迹。</div>
            </div>
          )}
        </section>

        <aside className="panel side-panel right-panel">
          <section className="panel-section score-panel">
            <div className="eyebrow">Submission readiness</div>
            <div className="score-head">
              <div className="decision-block">
                <div className="decision-label">Reviewer decision</div>
                <div className="decision-value">{decisionLabel(result?.decision)}</div>
                <div className="score-change">
                  {result ? `${result.scoreBefore} → ${result.scoreAfter} · +${Math.max(0, result.scoreAfter - result.scoreBefore)} pts` : '尚未生成评分'}
                </div>
              </div>
              <div
                className="score-orb"
                style={{ '--score-angle': `${(result?.scoreAfter ?? 0) * 3.6}deg` } as CSSProperties}
              >
                <div className="score-value"><strong>{result?.scoreAfter ?? '--'}</strong><span>OF 100</span></div>
              </div>
            </div>
            {result ? (
              <>
                <div className="summary-box">{result.summary}</div>
                <div className="decision-reason">{result.decisionReason}</div>
              </>
            ) : null}
          </section>

          <section className="panel-section">
            <div className="eyebrow">Audit metrics</div>
            <div style={{ marginTop: 12 }}>
              <div className="metric-row"><span>发现问题</span><strong>{result?.issues.length ?? 0}</strong></div>
              <div className="metric-row"><span>重大问题</span><strong>{majorIssues}</strong></div>
              <div className="metric-row"><span>术语规则</span><strong>{result?.terminology.length ?? 0}</strong></div>
              <div className="metric-row"><span>Agent 失败</span><strong>{failedAgents}</strong></div>
            </div>
          </section>

          <section className="panel-section">
            <div className="eyebrow">Deliverables</div>
            <p className="section-copy">当前版本提供三种真实下载格式；DOCX/PDF 将在文档解析版本接入。</p>
            <div className="deliverable-list">
              <button className="deliverable deliverable-button" disabled={!result} onClick={() => downloadArtifact('revision')} type="button">
                <div className="file-icon">TXT</div>
                <div><div className="file-name">Revised_Manuscript.txt</div><div className="file-state">下载保守修改稿</div></div>
              </button>
              <button className="deliverable deliverable-button" disabled={!result} onClick={() => downloadArtifact('report')} type="button">
                <div className="file-icon">MD</div>
                <div><div className="file-name">Audit_Report.md</div><div className="file-state">下载完整审校报告</div></div>
              </button>
              <button className="deliverable deliverable-button" disabled={!result} onClick={() => downloadArtifact('json')} type="button">
                <div className="file-icon">JSON</div>
                <div><div className="file-name">Review_Result.json</div><div className="file-state">下载结构化证据数据</div></div>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
