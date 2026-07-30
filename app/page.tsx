'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { SAMPLE_MANUSCRIPT } from '@/lib/demo-review';
import type { AgentId, ReviewIssue, ReviewResult } from '@/lib/types';

const AGENTS: Array<{
  id: AgentId;
  short: string;
  name: string;
  role: string;
}> = [
  { id: 'terminology', short: 'T', name: 'Terminology Guardian', role: '术语、缩写与单位一致性' },
  { id: 'language', short: 'A', name: 'Academic Editor', role: '语法、语气与学术表达' },
  { id: 'logic', short: 'L', name: 'Logic Auditor', role: '论证、因果与证据边界' },
  { id: 'method', short: 'M', name: 'Method Auditor', role: '方法完整性与可复现性' },
];

const AGENT_LABELS: Record<AgentId, string> = {
  terminology: '术语审校',
  language: '语言审校',
  logic: '逻辑审校',
  method: '方法审校',
};

const DEFAULT_GUARDRAILS = [
  { id: 'numbers', label: '不新增原文不存在的数值与试验结果', passed: true },
  { id: 'meaning', label: '不把语言润色伪装为科学结论修改', passed: true },
  { id: 'missing-info', label: '缺失信息保留为作者待补项', passed: true },
];

type ResultTab = 'comparison' | 'issues' | 'terms' | 'trace';
type SeverityFilter = 'all' | ReviewIssue['severity'];
type AgentFilter = 'all' | AgentId;
type MobileView = 'compose' | 'review' | 'issues' | 'export';

type ReviewPayload = ReviewResult & {
  error?: string;
  detail?: string;
  requestId?: string;
};

type HealthPayload = {
  status?: string;
  version?: string;
  provider?: string;
  model?: string;
  modelStudioConfigured?: boolean;
};

type HealthState = {
  state: 'checking' | 'configured' | 'demo' | 'offline';
  label: string;
  model: string;
  version: string;
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    document: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6z" /><path d="m9 12 2 2 4-5" /></>,
    agents: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c.5-4 2.2-6 5-6s4.5 2 5 6M14 20c.3-2.8 1.4-4.5 3.5-4.5S21 17.2 21 20" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 21h16" /></>,
    copy: <><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="M12 3 2.8 20h18.4z" /><path d="M12 9v4M12 17h.01" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    github: <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.2-4.7-5A3.9 3.9 0 0 1 7.7 9c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1.1a9.7 9.7 0 0 1 5.1 0c2-1.4 2.8-1.1 2.8-1.1.6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.7 5 .4.3.7 1 .7 2V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />,
  };

  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name] ?? paths.spark}
      </g>
    </svg>
  );
}

function decisionMeta(decision?: ReviewResult['decision']) {
  if (decision === 'ready') return { label: 'Ready for Submission', zh: '可投稿', tone: 'ready' };
  if (decision === 'minor_revision') return { label: 'Minor Revision', zh: '建议小修', tone: 'minor' };
  if (decision === 'major_revision') return { label: 'Major Revision', zh: '建议大修', tone: 'major' };
  return { label: 'Awaiting Review', zh: '等待审校', tone: 'pending' };
}

function severityLabel(severity: ReviewIssue['severity']) {
  if (severity === 'major') return 'Major';
  if (severity === 'minor') return 'Minor';
  return 'Suggestion';
}

function severityChinese(severity: ReviewIssue['severity']) {
  if (severity === 'major') return '重大问题';
  if (severity === 'minor') return '一般问题';
  return '优化建议';
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(1)} s`;
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
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
    `- Decision: ${decisionMeta(result.decision).label}\n` +
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

function SummaryColumn({
  result,
  majorIssues,
  failedAgents,
  issueCounts,
  onDownload,
}: {
  result: ReviewResult | null;
  majorIssues: number;
  failedAgents: number;
  issueCounts: Record<AgentId, number>;
  onDownload: (kind: 'revision' | 'report' | 'json') => void;
}) {
  const decision = decisionMeta(result?.decision);
  const score = result?.scoreAfter ?? 0;
  const scoreDelta = result ? result.scoreAfter - result.scoreBefore : 0;
  const maxRisk = Math.max(1, ...Object.values(issueCounts));

  return (
    <div className="summary-stack">
      <section className={`summary-card readiness-card tone-${decision.tone}`}>
        <div className="card-kicker">Submission readiness</div>
        <div className="readiness-head">
          <div>
            <span className="decision-zh">{decision.zh}</span>
            <h2>{decision.label}</h2>
            <p>{result ? `${result.scoreBefore} → ${result.scoreAfter} · ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} pts` : '完成审校后生成投稿判断'}</p>
          </div>
          <div
            className="score-ring"
            style={{ '--score-angle': `${score * 3.6}deg` } as CSSProperties}
          >
            <div><strong>{result ? score : '—'}</strong><span>/ 100</span></div>
          </div>
        </div>
        {result ? <div className="decision-summary">{result.summary}</div> : (
          <div className="decision-summary muted-summary">评分由规范化问题集和确定性规则计算，不由模型自由生成。</div>
        )}
        {result ? <p className="decision-reason">{result.decisionReason}</p> : null}
      </section>

      <section className="summary-card">
        <div className="card-heading-row">
          <div>
            <div className="card-kicker">Evidence profile</div>
            <h3>审校风险分布</h3>
          </div>
          <span className="metric-total">{result?.issues.length ?? 0}</span>
        </div>
        <div className="risk-list">
          {AGENTS.map((agent) => {
            const count = issueCounts[agent.id];
            return (
              <div className="risk-row" key={agent.id}>
                <div className="risk-label"><span>{agent.short}</span>{AGENT_LABELS[agent.id]}</div>
                <div className="risk-track"><i style={{ width: `${result ? Math.max(6, (count / maxRisk) * 100) : 0}%` }} /></div>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
        <div className="metric-grid">
          <div><span>重大问题</span><strong>{majorIssues}</strong></div>
          <div><span>Agent 失败</span><strong>{failedAgents}</strong></div>
          <div><span>术语规则</span><strong>{result?.terminology.length ?? 0}</strong></div>
          <div><span>工作流</span><strong>{result ? '完成' : '待运行'}</strong></div>
        </div>
      </section>

      <section className="summary-card deliverables-card">
        <div className="card-kicker">Deliverables</div>
        <h3>审校交付物</h3>
        <p className="card-description">只展示当前版本真实可下载的文件格式。</p>
        <div className="deliverable-list">
          <button disabled={!result} onClick={() => onDownload('revision')} type="button">
            <span className="file-type">TXT</span>
            <span><b>Revised Manuscript</b><small>保守修改稿</small></span>
            <Icon name="download" size={17} />
          </button>
          <button disabled={!result} onClick={() => onDownload('report')} type="button">
            <span className="file-type">MD</span>
            <span><b>Audit Report</b><small>完整审校报告</small></span>
            <Icon name="download" size={17} />
          </button>
          <button disabled={!result} onClick={() => onDownload('json')} type="button">
            <span className="file-type wide">JSON</span>
            <span><b>Review Evidence</b><small>结构化证据数据</small></span>
            <Icon name="download" size={17} />
          </button>
        </div>
        <div className="future-note">DOCX 修订模式与正式 PDF 报告将在文档解析版本中接入。</div>
      </section>
    </div>
  );
}

export default function Home() {
  const [text, setText] = useState(SAMPLE_MANUSCRIPT);
  const [targetJournal, setTargetJournal] = useState('Construction and Building Materials');
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('comparison');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('compose');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<HealthState>({
    state: 'checking',
    label: '正在检查百炼配置',
    model: 'qwen-plus',
    version: '0.3.0',
  });

  useEffect(() => {
    let alive = true;
    fetch('/api/health', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Health check failed');
        return response.json() as Promise<HealthPayload>;
      })
      .then((payload) => {
        if (!alive) return;
        const configured = Boolean(payload.modelStudioConfigured);
        setHealth({
          state: configured ? 'configured' : 'demo',
          label: configured ? '百炼服务端配置已检测' : '安全演示模式',
          model: payload.model || 'qwen-plus',
          version: payload.version || '0.3.0',
        });
      })
      .catch(() => {
        if (!alive) return;
        setHealth({ state: 'offline', label: '服务状态暂不可用', model: 'qwen-plus', version: '0.3.0' });
      });

    return () => { alive = false; };
  }, []);

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

  const issueCounts = useMemo<Record<AgentId, number>>(() => ({
    terminology: result?.issues.filter((issue) => issue.agent === 'terminology').length ?? 0,
    language: result?.issues.filter((issue) => issue.agent === 'language').length ?? 0,
    logic: result?.issues.filter((issue) => issue.agent === 'logic').length ?? 0,
    method: result?.issues.filter((issue) => issue.agent === 'method').length ?? 0,
  }), [result]);

  const filteredIssues = useMemo(() => {
    const priority: Record<ReviewIssue['severity'], number> = { major: 0, minor: 1, suggestion: 2 };
    return (result?.issues ?? [])
      .filter((issue) => severityFilter === 'all' || issue.severity === severityFilter)
      .filter((issue) => agentFilter === 'all' || issue.agent === agentFilter)
      .slice()
      .sort((a, b) => priority[a.severity] - priority[b.severity]);
  }, [result, severityFilter, agentFilter]);

  const lengthMessage = text.trim().length < 40
    ? '至少输入 40 个字符后才能启动审校'
    : text.length > 12_000
      ? '文本已超过 12,000 字符限制'
      : '文本长度符合审校要求';

  async function handleReview() {
    if (loading) return;
    setLoading(true);
    setElapsedMs(0);
    setError('');
    setResult(null);
    setActiveTab('comparison');
    setMobileView('review');
    setExpandedIssueId(null);

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
      setMobileView('compose');
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

  function switchMobileView(view: MobileView) {
    setMobileView(view);
    if (view === 'review') setActiveTab('comparison');
    if (view === 'issues') setActiveTab('issues');
    window.requestAnimationFrame(() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }));
  }

  const resultTabs: Array<{ id: ResultTab; label: string; count?: number }> = [
    { id: 'comparison', label: '对照审校' },
    { id: 'issues', label: '问题中心', count: result?.issues.length ?? 0 },
    { id: 'terms', label: '术语库', count: result?.terminology.length ?? 0 },
    { id: 'trace', label: '运行轨迹', count: result?.agentRuns.length ?? 0 },
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#workspace" aria-label="ScholarForge OS 首页">
            <span className="brand-mark">S</span>
            <span>
              <strong>ScholarForge OS <i>｜研语工坊</i></strong>
              <small>Evidence-aware academic writing workspace</small>
            </span>
          </a>

          <nav className="desktop-nav" aria-label="主要导航">
            <a href="#workspace">审校工作台</a>
            <a href="https://github.com/liqinglq666/scholarforge-os/blob/main/docs/technical.md" rel="noreferrer" target="_blank">技术架构</a>
            <a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank"><Icon name="github" size={16} /> GitHub</a>
          </nav>

          <div className="topbar-status">
            <div className={`service-status is-${health.state}`} title="健康检查仅验证服务端是否检测到百炼配置">
              <span className="status-dot" />
              <span>{health.label}</span>
            </div>
            <span className="version-badge">UI v{health.version}</span>
          </div>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="移动端工作区导航">
        <button aria-current={mobileView === 'compose'} onClick={() => switchMobileView('compose')} type="button"><Icon name="document" size={18} />输入</button>
        <button aria-current={mobileView === 'review'} onClick={() => switchMobileView('review')} type="button"><Icon name="spark" size={18} />结果</button>
        <button aria-current={mobileView === 'issues'} onClick={() => switchMobileView('issues')} type="button"><Icon name="alert" size={18} />问题<span>{result?.issues.length ?? 0}</span></button>
        <button aria-current={mobileView === 'export'} onClick={() => switchMobileView('export')} type="button"><Icon name="download" size={18} />导出</button>
      </nav>

      <div className="workspace" id="workspace">
        <aside className="context-rail left-rail">
          <section className="rail-card project-overview">
            <div className="card-kicker">Current project</div>
            <h2>论文审校空间</h2>
            <p>围绕同一段科研文本，沉淀问题、术语、运行证据和可下载结果。</p>
            <div className="project-ticket">
              <span>Active review</span>
              <strong>{targetJournal || 'Untitled journal review'}</strong>
              <small>Workflow {result?.workflowVersion || '0.2.0'} · Parallel specialists</small>
            </div>
          </section>

          <section className="rail-card">
            <div className="rail-title-row">
              <div>
                <div className="card-kicker">Agent team</div>
                <h3>并行专家组</h3>
              </div>
              <span className="agent-count">4</span>
            </div>
            <div className="parallel-note"><Icon name="agents" size={16} />4 个独立百炼请求同时执行</div>
            <div className="agent-list" aria-live="polite">
              {AGENTS.map((agent) => {
                const run = result?.agentRuns.find((item) => item.agent === agent.id);
                const done = run?.status === 'completed' || run?.status === 'demo';
                const failed = run?.status === 'failed';
                const running = loading;
                return (
                  <div className={`agent-row ${done ? 'is-done' : ''} ${running ? 'is-running' : ''} ${failed ? 'is-failed' : ''}`} key={agent.id}>
                    <span className="agent-avatar">{done ? <Icon name="check" size={16} /> : failed ? '!' : agent.short}</span>
                    <span className="agent-copy"><b>{agent.name}</b><small>{agent.role}</small></span>
                    <span className="agent-state">{done ? formatDuration(run.durationMs) : failed ? '失败' : running ? '运行中' : '等待'}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rail-card guardrail-card">
            <div className="card-kicker">Scientific guardrails</div>
            <h3>科研安全边界</h3>
            <div className="guardrail-list">
              {(result?.guardrails || DEFAULT_GUARDRAILS).map((guardrail) => (
                <div className={guardrail.passed ? 'guardrail is-passed' : 'guardrail is-warning'} key={guardrail.id}>
                  <span>{guardrail.passed ? <Icon name="check" size={15} /> : <Icon name="alert" size={15} />}</span>
                  <p>{guardrail.label}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="workbench">
          <div className={`mobile-section compose-section ${mobileView === 'compose' ? 'is-mobile-active' : ''}`}>
            <section className="hero-panel">
              <div className="hero-copy">
                <div className="hero-eyebrow"><span /> Parallel multi-agent manuscript review</div>
                <h1>让科研英语修改，<em>像同行评审一样有证据。</em></h1>
                <p>术语、语言、逻辑和方法四个专业 Agent 并行审查；每个结论都保留来源、理由和运行轨迹。</p>
              </div>
              <div className="hero-assurance">
                <Icon name="shield" size={22} />
                <span><b>Scientific meaning protected</b><small>科学含义保护开启</small></span>
              </div>
              <ol className="workflow-steps" aria-label="审校流程">
                <li className="is-current"><span>01</span><div><b>输入论文</b><small>粘贴科研英文与目标期刊</small></div></li>
                <li className={loading ? 'is-current' : result ? 'is-complete' : ''}><span>02</span><div><b>并行审查</b><small>4 个百炼 Agent 独立运行</small></div></li>
                <li className={result ? 'is-current' : ''}><span>03</span><div><b>核对与导出</b><small>查看证据并下载报告</small></div></li>
              </ol>
            </section>

            <section className="composer-card">
              <div className="section-heading">
                <div>
                  <span className="section-index">01</span>
                  <div><div className="card-kicker">Manuscript input</div><h2>准备审校文本</h2></div>
                </div>
                <div className={`length-status ${text.trim().length >= 40 && text.length <= 12_000 ? 'is-valid' : 'is-invalid'}`}>
                  <span>{text.length.toLocaleString()} / 12,000</span>
                  <small>{lengthMessage}</small>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="journal">目标期刊 <span>可选</span></label>
                <div className="input-shell"><Icon name="document" size={18} /><input id="journal" onChange={(event) => setTargetJournal(event.target.value)} placeholder="例如：Construction and Building Materials" value={targetJournal} /></div>
              </div>

              <div className="field-group manuscript-field">
                <label htmlFor="manuscript">科研英文段落</label>
                <textarea id="manuscript" onChange={(event) => setText(event.target.value)} placeholder="Paste an English manuscript passage here..." spellCheck={false} value={text} />
                <div className="text-meta"><span>{wordCount(text)} words</span><span>仅在服务端调用模型</span></div>
              </div>

              <div className="composer-actions">
                <button className="secondary-button" onClick={() => setText(SAMPLE_MANUSCRIPT)} type="button"><Icon name="refresh" size={17} />恢复示例</button>
                <button className="primary-button" disabled={loading || text.trim().length < 40 || text.length > 12_000} onClick={handleReview} type="button">
                  {loading ? <><span className="button-spinner" />4 个 Agent 正在并行审校</> : <><Icon name="spark" size={18} />启动全面审校<Icon name="chevron" size={17} /></>}
                </button>
              </div>
              <div aria-live="assertive">{error ? <div className="error-box"><Icon name="alert" size={18} /><div><b>审校请求未完成</b><span>{error}</span></div></div> : null}</div>
            </section>
          </div>

          <div className={`mobile-section review-section ${mobileView === 'review' || mobileView === 'issues' ? 'is-mobile-active' : ''}`}>
            {(loading || result) ? (
              <section className={`workflow-status ${loading ? 'is-loading' : 'is-complete'}`} aria-live="polite">
                <div className="workflow-status-head">
                  <span className="workflow-status-icon">{loading ? <span className="button-spinner" /> : <Icon name="check" size={18} />}</span>
                  <div><b>{loading ? '4 个专业 Agent 已同时发出请求' : '审校工作流已完成'}</b><small>{loading ? `已等待 ${(elapsedMs / 1_000).toFixed(1)} 秒，请保持页面开启` : `${result?.executionMode} · Workflow ${result?.workflowVersion}`}</small></div>
                  <span className="workflow-time"><Icon name="clock" size={16} />{loading ? `${(elapsedMs / 1_000).toFixed(1)} s` : '100%'}</span>
                </div>
                <div className="workflow-track"><i /></div>
                <div className="agent-pulse-row">
                  {AGENTS.map((agent) => {
                    const run = result?.agentRuns.find((item) => item.agent === agent.id);
                    return <span className={run?.status === 'failed' ? 'is-failed' : result ? 'is-complete' : 'is-running'} key={agent.id}><b>{agent.short}</b>{agent.name}<small>{run ? formatDuration(run.durationMs) : '并行运行中'}</small></span>;
                  })}
                </div>
              </section>
            ) : null}

            {result ? (
              <section className="results-card">
                <div className="results-header">
                  <div>
                    <span className="section-index">02</span>
                    <div><div className="card-kicker">Review evidence</div><h2>审校结果与证据</h2></div>
                  </div>
                  <span className={`live-mode ${result.mode === 'live' ? 'is-live' : 'is-demo'}`}><span className="status-dot" />{result.mode === 'live' ? `百炼真实多 Agent · ${health.model}` : '安全演示模式'}</span>
                </div>

                <div className="result-tabs" role="tablist" aria-label="审校结果分类">
                  {resultTabs.map((tab) => (
                    <button aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'is-active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">
                      {tab.label}{tab.count !== undefined ? <span>{tab.count}</span> : null}
                    </button>
                  ))}
                </div>

                <div className="result-body">
                  {activeTab === 'comparison' ? (
                    <div className="comparison-view">
                      <div className="comparison-toolbar">
                        <div><span>{wordCount(text)} → {wordCount(result.revisedText)} words</span><span>保守修改策略</span></div>
                        <button className="compact-button" onClick={copyRevision} type="button"><Icon name="copy" size={16} />{copied ? '已复制' : '复制修改稿'}</button>
                      </div>
                      <div className="comparison-grid">
                        <article className="manuscript-paper original-paper">
                          <header><div><span>Original manuscript</span><b>原始文本</b></div><small>{wordCount(text)} words</small></header>
                          <p>{text}</p>
                        </article>
                        <article className="manuscript-paper revised-paper">
                          <header><div><span>ScholarForge revision</span><b>保守修改稿</b></div><small>{wordCount(result.revisedText)} words</small></header>
                          <p>{result.revisedText}</p>
                        </article>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'issues' ? (
                    <div className="issues-view">
                      <div className="filter-bar">
                        <div className="filter-title"><Icon name="filter" size={17} /><span>筛选审校问题</span></div>
                        <label>严重程度<select onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} value={severityFilter}><option value="all">全部</option><option value="major">Major</option><option value="minor">Minor</option><option value="suggestion">Suggestion</option></select></label>
                        <label>来源 Agent<select onChange={(event) => setAgentFilter(event.target.value as AgentFilter)} value={agentFilter}><option value="all">全部</option>{AGENTS.map((agent) => <option key={agent.id} value={agent.id}>{AGENT_LABELS[agent.id]}</option>)}</select></label>
                        <span className="filter-result">显示 {filteredIssues.length} / {result.issues.length}</span>
                      </div>
                      <div className="issue-list">
                        {filteredIssues.map((issue, index) => {
                          const expanded = expandedIssueId === issue.id;
                          return (
                            <article className={`issue-card severity-${issue.severity} ${expanded ? 'is-expanded' : ''}`} key={issue.id}>
                              <button aria-expanded={expanded} className="issue-summary" onClick={() => setExpandedIssueId(expanded ? null : issue.id)} type="button">
                                <span className="issue-number">{String(index + 1).padStart(2, '0')}</span>
                                <span className="issue-main"><span className="issue-badges"><i>{AGENT_LABELS[issue.agent]}</i><i>{severityChinese(issue.severity)}</i><i>{issue.location}</i></span><b>{issue.category}</b><small>{issue.reason}</small></span>
                                <span className="issue-expand"><Icon name="chevron" size={18} /></span>
                              </button>
                              {expanded ? (
                                <div className="issue-detail">
                                  <div className="issue-change-grid">
                                    <div><span>Original</span><p>{issue.original || 'No original excerpt supplied.'}</p></div>
                                    <div><span>Suggested revision</span><p>{issue.revised || 'Author action required.'}</p></div>
                                  </div>
                                  <div className={`meaning-note ${issue.meaningChanged ? 'is-warning' : ''}`}><Icon name={issue.meaningChanged ? 'alert' : 'shield'} size={16} />{issue.meaningChanged ? '该建议可能影响科学含义，请作者重点核对。' : '该建议未被 Agent 标记为科学含义变化。'}</div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                        {!filteredIssues.length ? <div className="empty-filter">当前筛选条件下没有问题。</div> : null}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'terms' ? (
                    <div className="term-grid">
                      {result.terminology.length ? result.terminology.map((term, index) => (
                        <article className="term-card" key={`${term.preferred}-${index}`}>
                          <span className="term-index">{String(index + 1).padStart(2, '0')}</span>
                          <h3>{term.preferred}</h3>
                          {term.avoid.length ? <div className="term-avoid"><b>避免混用</b>{term.avoid.join(' · ')}</div> : null}
                          <p>{term.note}</p>
                        </article>
                      )) : <div className="empty-result"><Icon name="check" size={24} /><b>本段未生成额外术语规则</b><span>术语 Agent 没有发现需要建立的统一表达。</span></div>}
                    </div>
                  ) : null}

                  {activeTab === 'trace' ? (
                    <div className="trace-grid">
                      {result.agentRuns.map((run) => (
                        <article className={`trace-card status-${run.status}`} key={run.agent}>
                          <header><span className="trace-avatar">{AGENTS.find((agent) => agent.id === run.agent)?.short}</span><div><b>{AGENT_LABELS[run.agent]}</b><small>{run.model}</small></div><i>{run.status}</i></header>
                          <p>{run.summary}</p>
                          <div className="trace-metrics"><span><Icon name="clock" size={15} />耗时 <b>{formatDuration(run.durationMs)}</b></span><span><Icon name="alert" size={15} />问题 <b>{run.issueCount}</b></span></div>
                          {run.error ? <div className="trace-error"><Icon name="alert" size={15} />{run.error}</div> : null}
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : !loading ? (
              <section className="evidence-empty">
                <div className="empty-illustration"><span>T</span><span>A</span><span>L</span><span>M</span><i><Icon name="spark" size={24} /></i></div>
                <div><div className="card-kicker">Evidence workspace</div><h2>审校结果会在这里形成一条完整证据链</h2><p>启动后可查看原文对照、问题分级、术语规则、模型运行轨迹与真实交付物。</p></div>
              </section>
            ) : null}
          </div>

          <div className={`mobile-summary mobile-section ${mobileView === 'export' ? 'is-mobile-active' : ''}`}>
            <SummaryColumn failedAgents={failedAgents} issueCounts={issueCounts} majorIssues={majorIssues} onDownload={downloadArtifact} result={result} />
          </div>
        </section>

        <aside className="context-rail right-rail">
          <SummaryColumn failedAgents={failedAgents} issueCounts={issueCounts} majorIssues={majorIssues} onDownload={downloadArtifact} result={result} />
        </aside>
      </div>

      <footer className="site-footer">
        <span>ScholarForge OS · Evidence-aware academic writing</span>
        <span>Powered by Alibaba Cloud Model Studio · {health.model}</span>
        <a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">查看开源仓库 <Icon name="external" size={14} /></a>
      </footer>
    </main>
  );
}
