'use client';

import { useMemo, useState } from 'react';
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

const DELIVERABLES = [
  ['DOCX', 'Manuscript_Revised.docx'],
  ['XLSX', 'Revision_Matrix.xlsx'],
  ['PDF', 'Language_Audit_Report.pdf'],
];

const AGENT_LABELS: Record<AgentId, string> = {
  terminology: '术语 Agent',
  language: '语言 Agent',
  logic: '逻辑 Agent',
  method: '方法 Agent',
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

export default function Home() {
  const [text, setText] = useState(SAMPLE_MANUSCRIPT);
  const [targetJournal, setTargetJournal] = useState('Construction and Building Materials');
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(-1);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<'comparison' | 'issues' | 'terms'>('comparison');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const majorIssues = useMemo(
    () => result?.issues.filter((issue) => issue.severity === 'major').length ?? 0,
    [result],
  );

  const progress = loading
    ? Math.max(8, ((activeAgent + 1) / AGENTS.length) * 82)
    : result
      ? 100
      : 0;

  async function handleReview() {
    if (loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    setActiveTab('comparison');
    setActiveAgent(0);

    const timer = window.setInterval(() => {
      setActiveAgent((current) => Math.min(current + 1, AGENTS.length - 1));
    }, 850);

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetJournal }),
      });
      const payload = await response.json() as ReviewResult & { error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'Review request failed.');
      }

      setResult(payload);
      setActiveAgent(AGENTS.length);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '审校失败，请检查配置后重试。');
      setActiveAgent(-1);
    } finally {
      window.clearInterval(timer);
      setLoading(false);
    }
  }

  async function copyRevision() {
    if (!result?.revisedText) return;
    await navigator.clipboard.writeText(result.revisedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
          <div className="status-chip"><span className="status-dot" /> Workspace protected</div>
          <span className="small-chip">MVP · v0.1</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="panel side-panel left-panel">
          <section className="panel-section">
            <div className="eyebrow">Current project</div>
            <h2 className="section-title">论文项目空间</h2>
            <p className="section-copy">每篇论文独立保存术语、审校记录和投稿材料。</p>
            <div className="project-card">
              <div className="project-card-label">Active manuscript</div>
              <h3>Binder-dependent performance of ECC</h3>
              <p>Version 01 · Methods review</p>
            </div>
          </section>

          <section className="panel-section">
            <div className="eyebrow">Agent team</div>
            <div className="agent-list">
              {AGENTS.map((agent, index) => {
                const done = result ? true : activeAgent > index;
                const running = loading && activeAgent === index;
                return (
                  <div
                    className={`agent-row ${done ? 'is-done' : ''} ${running ? 'is-running' : ''}`}
                    key={agent.id}
                  >
                    <div className="agent-icon">{done ? '✓' : agent.icon}</div>
                    <div>
                      <div className="agent-name">{agent.name}</div>
                      <div className="agent-role">{agent.role}</div>
                    </div>
                    <div className="agent-state">
                      {done ? '完成' : running ? '运行中' : '等待'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel-section">
            <div className="eyebrow">Scientific guardrails</div>
            <div className="guardrail-list">
              <div className="guardrail"><b>✓</b><span>不虚构实验数据、样本数量与参考文献</span></div>
              <div className="guardrail"><b>✓</b><span>缺失信息使用作者占位符，不擅自补写</span></div>
              <div className="guardrail"><b>✓</b><span>区分语言问题、逻辑问题与方法问题</span></div>
            </div>
          </section>
        </aside>

        <section className="panel main-panel">
          <div className="hero">
            <div className="hero-head">
              <div>
                <div className="eyebrow">Multi-agent manuscript review</div>
                <h1>让每一次科研英语修改<br />都有<em>依据</em>。</h1>
                <p>四个专业 Agent 围绕同一论文空间协作，完成术语统一、语言润色、逻辑审校与方法完整性检查，并给出可追踪的修改理由。</p>
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
                {loading ? 'Agent 团队正在审校…' : '启动全面审校 →'}
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
                <span>{loading ? `${AGENTS[Math.min(activeAgent, 3)]?.name ?? 'Orchestrator'} 正在处理` : '审校工作流已完成'}</span>
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
              </div>

              <div className="result-content">
                <div className="result-toolbar">
                  <span className={`mode-chip ${result.mode === 'live' ? 'live' : ''}`}>
                    <span className="status-dot" />
                    {result.mode === 'live' ? '百炼实时审校' : '安全演示模式'}
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
                      <div className="paper-label">ScholarForge revision</div>
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
              </div>
            </div>
          ) : (
            <div className="empty-result">
              <div className="empty-icon">⌁</div>
              <div>启动审校后，这里会显示原文对照、问题证据与术语规则。</div>
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
            {result ? <div className="summary-box">{result.summary}</div> : null}
          </section>

          <section className="panel-section">
            <div className="eyebrow">Audit metrics</div>
            <div style={{ marginTop: 12 }}>
              <div className="metric-row"><span>发现问题</span><strong>{result?.issues.length ?? 0}</strong></div>
              <div className="metric-row"><span>重大问题</span><strong>{majorIssues}</strong></div>
              <div className="metric-row"><span>术语规则</span><strong>{result?.terminology.length ?? 0}</strong></div>
              <div className="metric-row"><span>科学含义改变</span><strong>{result?.issues.filter((item) => item.meaningChanged).length ?? 0}</strong></div>
            </div>
          </section>

          <section className="panel-section">
            <div className="eyebrow">Deliverables</div>
            <p className="section-copy">比赛后续版本将把已接受的修改导出为正式文件。</p>
            <div className="deliverable-list">
              {DELIVERABLES.map(([type, name]) => (
                <div className="deliverable" key={name}>
                  <div className="file-icon">{type}</div>
                  <div>
                    <div className="file-name">{name}</div>
                    <div className="file-state">{result ? '待导出模块接入' : '等待审校'}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
