'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { SAMPLE_MANUSCRIPT } from '@/lib/demo-review';
import type { AgentId, ReviewIssue, ReviewResult } from '@/lib/types';

const DRAFT_KEY = 'scholarforge-os-review-draft-v1';

const AGENTS: Array<{ id: AgentId; short: string; name: string; role: string }> = [
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

type ResultTab = 'comparison' | 'actions' | 'issues' | 'terms' | 'trace';
type SeverityFilter = 'all' | ReviewIssue['severity'];
type AgentFilter = 'all' | AgentId;
type MobileView = 'compose' | 'review' | 'issues' | 'export';

type ReviewPayload = ReviewResult & {
  error?: string;
  detail?: string;
  requestId?: string;
};

type HealthPayload = {
  version?: string;
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
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1 2-2V8a2 2 0 0 1 2-2h6" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    save: <><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></>,
    github: <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.2-4.7-5A3.9 3.9 0 0 1 7.7 9c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1.1a9.7 9.7 0 0 1 5.1 0c2-1.4 2.8-1.1 2.8-1.1.6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.7 5 .4.3.7 1 .7 2V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />,
  };

  return (
    <svg aria-hidden="true" className="sf-icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
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
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'scholarforge-review';
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
    ? result.terminology.map((term) => [`- **${term.preferred}**`, term.avoid.length ? `  - Avoid: ${term.avoid.join(', ')}` : '', `  - Note: ${term.note}`].filter(Boolean).join('\n')).join('\n')
    : '- No terminology rule was generated for this passage.';

  const traceLines = result.agentRuns.map((run) => `- ${AGENT_LABELS[run.agent]}: ${run.status}, ${formatDuration(run.durationMs)}, ${run.issueCount} issues, model=${run.model}`).join('\n');

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
  actionCount,
  onDownload,
  onCopyActions,
}: {
  result: ReviewResult | null;
  majorIssues: number;
  failedAgents: number;
  issueCounts: Record<AgentId, number>;
  actionCount: number;
  onDownload: (kind: 'revision' | 'report' | 'json') => void;
  onCopyActions: () => void;
}) {
  const decision = decisionMeta(result?.decision);
  const score = result?.scoreAfter ?? 0;
  const delta = result ? result.scoreAfter - result.scoreBefore : 0;
  const maxRisk = Math.max(1, ...Object.values(issueCounts));

  return (
    <div className="sf-summary-stack">
      <section className={`sf-summary-card sf-readiness tone-${decision.tone}`}>
        <div className="sf-kicker">Submission readiness</div>
        <div className="sf-readiness-head">
          <div>
            <span className="sf-decision-zh">{decision.zh}</span>
            <h2>{decision.label}</h2>
            <p>{result ? `${result.scoreBefore} → ${result.scoreAfter} · ${delta >= 0 ? '+' : ''}${delta} pts` : '完成审校后生成投稿判断'}</p>
          </div>
          <div className="sf-score-ring" style={{ '--score-angle': `${score * 3.6}deg` } as CSSProperties}>
            <div><strong>{result ? score : '—'}</strong><span>/ 100</span></div>
          </div>
        </div>
        <div className="sf-decision-summary">{result ? result.summary : '评分由问题类别、严重程度和未解决风险确定，不由模型自由生成。'}</div>
        {result ? <p className="sf-decision-reason">{result.decisionReason}</p> : null}
      </section>

      <section className="sf-summary-card">
        <div className="sf-card-head"><div><div className="sf-kicker">Evidence profile</div><h3>风险分布</h3></div><span>{result?.issues.length ?? 0}</span></div>
        <div className="sf-risk-list">
          {AGENTS.map((agent) => {
            const count = issueCounts[agent.id];
            return (
              <div className="sf-risk-row" key={agent.id}>
                <div className="sf-risk-label"><i>{agent.short}</i>{AGENT_LABELS[agent.id]}</div>
                <div className="sf-risk-track"><span style={{ width: `${result ? Math.max(5, (count / maxRisk) * 100) : 0}%` }} /></div>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
        <div className="sf-metric-grid">
          <div><span>重大问题</span><strong>{majorIssues}</strong></div>
          <div><span>作者待办</span><strong>{actionCount}</strong></div>
          <div><span>术语规则</span><strong>{result?.terminology.length ?? 0}</strong></div>
          <div><span>Agent 失败</span><strong>{failedAgents}</strong></div>
        </div>
      </section>

      <section className="sf-summary-card">
        <div className="sf-kicker">Deliverables</div>
        <h3>审校交付物</h3>
        <p className="sf-card-copy">以下文件均由浏览器即时生成，可直接下载。</p>
        <div className="sf-deliverables">
          <button disabled={!result} onClick={() => onDownload('revision')} type="button"><i>TXT</i><span><b>Revised Manuscript</b><small>保守修改稿</small></span><Icon name="download" size={17} /></button>
          <button disabled={!result} onClick={() => onDownload('report')} type="button"><i>MD</i><span><b>Audit Report</b><small>完整审校报告</small></span><Icon name="download" size={17} /></button>
          <button disabled={!result} onClick={() => onDownload('json')} type="button"><i>JSON</i><span><b>Review Evidence</b><small>结构化证据</small></span><Icon name="download" size={17} /></button>
        </div>
        <button className="sf-action-copy" disabled={!actionCount} onClick={onCopyActions} type="button"><Icon name="list" size={16} />复制作者待办清单</button>
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
  const [requestId, setRequestId] = useState('');
  const [activeTab, setActiveTab] = useState<ResultTab>('comparison');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [issueQuery, setIssueQuery] = useState('');
  const [expandedIssueIds, setExpandedIssueIds] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<MobileView>('compose');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [health, setHealth] = useState<HealthState>({ state: 'checking', label: '正在检查百炼配置', model: 'qwen-plus', version: '0.4.0' });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const draft = JSON.parse(stored) as { text?: string; targetJournal?: string; savedAt?: string };
        if (draft.text?.trim()) setText(draft.text);
        if (typeof draft.targetJournal === 'string') setTargetJournal(draft.targetJournal);
        if (draft.savedAt) setDraftSavedAt(draft.savedAt);
      }
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, targetJournal, savedAt }));
      setDraftSavedAt(savedAt);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [draftReady, targetJournal, text]);

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
        setHealth({ state: configured ? 'configured' : 'demo', label: configured ? '百炼服务端已配置' : '安全演示模式', model: payload.model || 'qwen-plus', version: payload.version || '0.4.0' });
      })
      .catch(() => {
        if (!alive) return;
        setHealth({ state: 'offline', label: '服务状态暂不可用', model: 'qwen-plus', version: '0.4.0' });
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 120);
    return () => window.clearInterval(timer);
  }, [loading]);

  const majorIssues = useMemo(() => result?.issues.filter((issue) => issue.severity === 'major').length ?? 0, [result]);
  const failedAgents = useMemo(() => result?.agentRuns.filter((run) => run.status === 'failed').length ?? 0, [result]);
  const issueCounts = useMemo<Record<AgentId, number>>(() => ({
    terminology: result?.issues.filter((issue) => issue.agent === 'terminology').length ?? 0,
    language: result?.issues.filter((issue) => issue.agent === 'language').length ?? 0,
    logic: result?.issues.filter((issue) => issue.agent === 'logic').length ?? 0,
    method: result?.issues.filter((issue) => issue.agent === 'method').length ?? 0,
  }), [result]);

  const actionItems = useMemo(() => {
    const source = result?.issues.filter((issue) => issue.severity === 'major' || issue.agent === 'method' || issue.agent === 'logic' || issue.revised.includes('[Please provide')) ?? [];
    const seen = new Set<string>();
    return source.filter((issue) => {
      const key = `${issue.location}|${issue.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [result]);

  const filteredIssues = useMemo(() => {
    const priority: Record<ReviewIssue['severity'], number> = { major: 0, minor: 1, suggestion: 2 };
    const query = issueQuery.trim().toLowerCase();
    return (result?.issues ?? [])
      .filter((issue) => severityFilter === 'all' || issue.severity === severityFilter)
      .filter((issue) => agentFilter === 'all' || issue.agent === agentFilter)
      .filter((issue) => !query || [issue.category, issue.location, issue.reason, issue.original, issue.revised].join(' ').toLowerCase().includes(query))
      .slice()
      .sort((a, b) => priority[a.severity] - priority[b.severity]);
  }, [agentFilter, issueQuery, result, severityFilter]);

  const inputValid = text.trim().length >= 40 && text.length <= 12_000;
  const saveLabel = draftSavedAt ? `草稿已自动保存 · ${new Date(draftSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '草稿将在本机自动保存';

  async function handleReview() {
    if (loading || !inputValid) return;
    setLoading(true);
    setElapsedMs(0);
    setError('');
    setResult(null);
    setRequestId('');
    setActiveTab('comparison');
    setMobileView('review');
    setExpandedIssueIds([]);

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetJournal }),
      });
      const payload = await response.json() as ReviewPayload;
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Review request failed.');
      setResult(payload);
      setRequestId(payload.requestId || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '审校失败，请检查配置后重试。');
      setMobileView('compose');
    } finally {
      setLoading(false);
    }
  }

  function startNewReview() {
    setText('');
    setTargetJournal('');
    setResult(null);
    setRequestId('');
    setActiveTab('comparison');
    setSeverityFilter('all');
    setAgentFilter('all');
    setIssueQuery('');
    setExpandedIssueIds([]);
    setMobileView('compose');
    setError('');
    window.localStorage.removeItem(DRAFT_KEY);
    setDraftSavedAt('');
    window.requestAnimationFrame(() => document.getElementById('sf-manuscript')?.focus());
  }

  function restoreSample() {
    setText(SAMPLE_MANUSCRIPT);
    setTargetJournal('Construction and Building Materials');
    setResult(null);
    setMobileView('compose');
  }

  async function copyRevision() {
    if (!result?.revisedText) return;
    await navigator.clipboard.writeText(result.revisedText);
    setCopied('revision');
    window.setTimeout(() => setCopied(''), 1_500);
  }

  async function copyActions() {
    if (!actionItems.length) return;
    const content = actionItems.map((issue, index) => `- [ ] ${index + 1}. ${issue.location} · ${issue.category}\n  - ${issue.reason}\n  - 建议：${issue.revised || '请作者补充或核对'}`).join('\n');
    await navigator.clipboard.writeText(content);
    setCopied('actions');
    window.setTimeout(() => setCopied(''), 1_500);
  }

  function toggleIssue(id: string) {
    setExpandedIssueIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllIssues() {
    const ids = filteredIssues.map((issue) => issue.id);
    const allExpanded = ids.length > 0 && ids.every((id) => expandedIssueIds.includes(id));
    setExpandedIssueIds((current) => allExpanded ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  }

  function downloadArtifact(kind: 'revision' | 'report' | 'json') {
    if (!result) return;
    const stem = safeFileStem(targetJournal);
    if (kind === 'revision') {
      downloadText(`${stem}-revised.txt`, result.revisedText, 'text/plain;charset=utf-8');
      return;
    }
    if (kind === 'report') {
      downloadText(`${stem}-audit-report.md`, buildMarkdownReport(result, text, targetJournal), 'text/markdown;charset=utf-8');
      return;
    }
    downloadText(`${stem}-review-result.json`, JSON.stringify({ targetJournal, sourceText: text, requestId, ...result }, null, 2), 'application/json;charset=utf-8');
  }

  function switchMobileView(view: MobileView) {
    setMobileView(view);
    if (view === 'review') setActiveTab('comparison');
    if (view === 'issues') setActiveTab('issues');
    window.requestAnimationFrame(() => document.getElementById('sf-workspace')?.scrollIntoView({ behavior: 'smooth' }));
  }

  const resultTabs: Array<{ id: ResultTab; label: string; count?: number }> = [
    { id: 'comparison', label: '对照审校' },
    { id: 'actions', label: '作者待办', count: actionItems.length },
    { id: 'issues', label: '问题中心', count: result?.issues.length ?? 0 },
    { id: 'terms', label: '术语库', count: result?.terminology.length ?? 0 },
    { id: 'trace', label: '运行轨迹', count: result?.agentRuns.length ?? 0 },
  ];

  return (
    <main className="sf-shell">
      <header className="sf-topbar">
        <div className="sf-topbar-inner">
          <a className="sf-brand" href="#sf-workspace" aria-label="ScholarForge OS 首页">
            <span className="sf-brand-mark">S</span>
            <span><strong>ScholarForge OS <i>｜研语工坊</i></strong><small>Evidence-aware academic writing workspace</small></span>
          </a>
          <nav className="sf-desktop-nav" aria-label="主要导航">
            <a href="#sf-workspace">审校工作台</a>
            <a href="https://github.com/liqinglq666/scholarforge-os/blob/main/docs/technical.md" rel="noreferrer" target="_blank">技术架构</a>
            <a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank"><Icon name="github" size={16} />GitHub</a>
          </nav>
          <div className="sf-topbar-actions">
            <button className="sf-new-review" onClick={startNewReview} type="button"><Icon name="plus" size={16} />新建审校</button>
            <div className={`sf-service-status is-${health.state}`} title="健康检查仅验证服务端是否检测到百炼配置"><span />{health.label}</div>
            <span className="sf-version">v{health.version}</span>
          </div>
        </div>
      </header>

      <nav className="sf-mobile-nav" aria-label="移动端工作区导航">
        <button aria-current={mobileView === 'compose'} onClick={() => switchMobileView('compose')} type="button"><Icon name="document" size={18} />输入</button>
        <button aria-current={mobileView === 'review'} onClick={() => switchMobileView('review')} type="button"><Icon name="spark" size={18} />结果</button>
        <button aria-current={mobileView === 'issues'} onClick={() => switchMobileView('issues')} type="button"><Icon name="alert" size={18} />问题<i>{result?.issues.length ?? 0}</i></button>
        <button aria-current={mobileView === 'export'} onClick={() => switchMobileView('export')} type="button"><Icon name="download" size={18} />导出</button>
      </nav>

      <div className="sf-workspace" id="sf-workspace">
        <aside className="sf-left-rail">
          <section className="sf-rail-card sf-project-card">
            <div className="sf-kicker">Current project</div>
            <h2>论文审校空间</h2>
            <p>一个任务、一条证据链。输入、审查、核对和导出都围绕当前论文片段展开。</p>
            <div className="sf-project-ticket"><span>Active review</span><strong>{targetJournal || '未命名期刊审校'}</strong><small>Workflow {result?.workflowVersion || '0.2.0'} · 4 parallel specialists</small></div>
            <div className="sf-draft-state"><Icon name="save" size={15} /><span>{saveLabel}</span></div>
          </section>

          <section className="sf-rail-card">
            <div className="sf-rail-head"><div><div className="sf-kicker">Agent team</div><h3>并行专家组</h3></div><span>4</span></div>
            <div className="sf-parallel-note"><Icon name="agents" size={16} />4 个独立百炼请求同时执行</div>
            <div className="sf-agent-list" aria-live="polite">
              {AGENTS.map((agent) => {
                const run = result?.agentRuns.find((item) => item.agent === agent.id);
                const done = run?.status === 'completed' || run?.status === 'demo';
                const failed = run?.status === 'failed';
                return (
                  <div className={`sf-agent-row ${done ? 'is-done' : ''} ${loading ? 'is-running' : ''} ${failed ? 'is-failed' : ''}`} key={agent.id}>
                    <span className="sf-agent-avatar">{done ? <Icon name="check" size={15} /> : failed ? '!' : agent.short}</span>
                    <span className="sf-agent-copy"><b>{agent.name}</b><small>{agent.role}</small></span>
                    <span className="sf-agent-state">{done ? formatDuration(run.durationMs) : failed ? '失败' : loading ? '运行中' : '等待'}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="sf-rail-card">
            <div className="sf-kicker">Scientific guardrails</div>
            <h3>科研安全边界</h3>
            <div className="sf-guardrail-list">
              {(result?.guardrails || DEFAULT_GUARDRAILS).map((guardrail) => <div className={guardrail.passed ? 'is-passed' : 'is-warning'} key={guardrail.id}><span>{guardrail.passed ? <Icon name="check" size={15} /> : <Icon name="alert" size={15} />}</span><p>{guardrail.label}</p></div>)}
            </div>
          </section>
        </aside>

        <section className="sf-main-column">
          <div className={`sf-mobile-section ${mobileView === 'compose' ? 'is-mobile-active' : ''}`}>
            <section className="sf-hero">
              <div className="sf-hero-copy"><div className="sf-hero-eyebrow"><span />Parallel multi-agent manuscript review</div><h1>让科研英语修改，<em>像同行评审一样有证据。</em></h1><p>不是一次泛化润色，而是术语、语言、逻辑与方法四条专业审校链并行工作。</p></div>
              <div className="sf-assurance"><Icon name="shield" size={22} /><span><b>Scientific meaning protected</b><small>科学含义保护开启</small></span></div>
              <ol className="sf-steps"><li className="is-current"><span>01</span><div><b>输入论文</b><small>文本与目标期刊</small></div></li><li className={loading ? 'is-current' : result ? 'is-complete' : ''}><span>02</span><div><b>并行审查</b><small>4 个独立 Agent</small></div></li><li className={result ? 'is-current' : ''}><span>03</span><div><b>核对导出</b><small>证据与作者待办</small></div></li></ol>
            </section>

            <section className="sf-composer">
              <div className="sf-section-head"><div><span>01</span><div><div className="sf-kicker">Manuscript input</div><h2>准备审校文本</h2></div></div><div className={inputValid ? 'sf-length is-valid' : 'sf-length is-invalid'}><b>{text.length.toLocaleString()} / 12,000</b><small>{text.trim().length < 40 ? '至少输入 40 个字符' : text.length > 12_000 ? '文本超出限制' : `${wordCount(text)} words · 可以开始审校`}</small></div></div>
              <div className="sf-field"><label htmlFor="sf-journal">目标期刊 <span>可选</span></label><div className="sf-input-shell"><Icon name="document" size={18} /><input id="sf-journal" onChange={(event) => setTargetJournal(event.target.value)} placeholder="例如：Construction and Building Materials" value={targetJournal} /></div></div>
              <div className="sf-field"><label htmlFor="sf-manuscript">科研英文段落</label><textarea id="sf-manuscript" onChange={(event) => setText(event.target.value)} placeholder="Paste an English manuscript passage here..." spellCheck={false} value={text} /><div className="sf-text-meta"><span><Icon name="save" size={14} />{saveLabel}</span><span><Icon name="shield" size={14} />模型仅在服务端调用</span></div></div>
              <div className="sf-composer-actions"><div><button className="sf-ghost-button" onClick={restoreSample} type="button"><Icon name="refresh" size={16} />恢复示例</button><button className="sf-ghost-button danger" onClick={startNewReview} type="button"><Icon name="trash" size={16} />清空</button></div><button className="sf-primary-button" disabled={loading || !inputValid} onClick={handleReview} type="button">{loading ? <><span className="sf-spinner" />4 个 Agent 正在并行审校</> : <><Icon name="spark" size={18} />启动全面审校<Icon name="chevron" size={17} /></>}</button></div>
              <div aria-live="assertive">{error ? <div className="sf-error"><Icon name="alert" size={18} /><div><b>审校请求未完成</b><span>{error}</span></div><button onClick={handleReview} type="button">重试</button></div> : null}</div>
            </section>
          </div>

          <div className={`sf-mobile-section ${mobileView === 'review' || mobileView === 'issues' ? 'is-mobile-active' : ''}`}>
            {(loading || result) ? <section className={`sf-workflow-status ${loading ? 'is-loading' : 'is-complete'}`} aria-live="polite"><div className="sf-workflow-head"><span className="sf-workflow-icon">{loading ? <span className="sf-spinner" /> : <Icon name="check" size={18} />}</span><div><b>{loading ? '四个专业 Agent 已同时发出请求' : '审校工作流已完成'}</b><small>{loading ? `已等待 ${(elapsedMs / 1_000).toFixed(1)} 秒，请保持页面开启` : `${result?.executionMode} · Workflow ${result?.workflowVersion}${requestId ? ` · ${requestId}` : ''}`}</small></div><span><Icon name="clock" size={16} />{loading ? `${(elapsedMs / 1_000).toFixed(1)} s` : '完成'}</span></div><div className="sf-workflow-track"><i /></div><div className="sf-agent-pulse">{AGENTS.map((agent) => { const run = result?.agentRuns.find((item) => item.agent === agent.id); return <span className={run?.status === 'failed' ? 'is-failed' : result ? 'is-complete' : 'is-running'} key={agent.id}><b>{agent.short}</b>{agent.name}<small>{run ? formatDuration(run.durationMs) : '并行运行中'}</small></span>; })}</div></section> : null}

            {result ? (
              <section className="sf-results">
                <div className="sf-results-head"><div><span>02</span><div><div className="sf-kicker">Review evidence</div><h2>审校结果与证据</h2></div></div><div className="sf-results-actions"><span className={`sf-live-mode ${result.mode === 'live' ? 'is-live' : 'is-demo'}`}><i />{result.mode === 'live' ? `百炼真实多 Agent · ${health.model}` : '安全演示模式'}</span><button onClick={handleReview} type="button"><Icon name="refresh" size={15} />重新审校</button></div></div>
                <div className="sf-tabs" role="tablist" aria-label="审校结果分类">{resultTabs.map((tab) => <button aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'is-active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">{tab.label}{tab.count !== undefined ? <span>{tab.count}</span> : null}</button>)}</div>
                <div className="sf-result-body">
                  {activeTab === 'comparison' ? <div className="sf-comparison"><div className="sf-comparison-toolbar"><div><span>{wordCount(text)} → {wordCount(result.revisedText)} words</span><span>保守修改策略</span></div><button onClick={copyRevision} type="button"><Icon name="copy" size={16} />{copied === 'revision' ? '已复制' : '复制修改稿'}</button></div><div className="sf-paper-grid"><article className="sf-paper"><header><div><span>Original manuscript</span><b>原始文本</b></div><small>{wordCount(text)} words</small></header><p>{text}</p></article><article className="sf-paper is-revised"><header><div><span>ScholarForge revision</span><b>保守修改稿</b></div><small>{wordCount(result.revisedText)} words</small></header><p>{result.revisedText}</p></article></div></div> : null}

                  {activeTab === 'actions' ? <div className="sf-actions-view"><div className="sf-action-intro"><div><div className="sf-kicker">Author action list</div><h3>先处理这些，再继续投稿</h3><p>由 Major、逻辑、方法和待补信息问题自动归纳，不替代作者最终判断。</p></div><button disabled={!actionItems.length} onClick={copyActions} type="button"><Icon name="copy" size={16} />{copied === 'actions' ? '已复制' : '复制 Markdown 清单'}</button></div>{actionItems.length ? <div className="sf-action-list">{actionItems.map((issue, index) => <article key={issue.id}><span>{String(index + 1).padStart(2, '0')}</span><div><div><i>{AGENT_LABELS[issue.agent]}</i><i>{severityChinese(issue.severity)}</i><i>{issue.location}</i></div><h4>{issue.category}</h4><p>{issue.reason}</p><small>{issue.revised || '请作者补充、核对或重新表述。'}</small></div></article>)}</div> : <div className="sf-empty"><Icon name="check" size={25} /><b>没有需要单独归纳的作者待办</b><span>当前问题均可在普通审校建议中处理。</span></div>}</div> : null}

                  {activeTab === 'issues' ? <div className="sf-issues-view"><div className="sf-filter-bar"><div className="sf-search-shell"><Icon name="search" size={16} /><input onChange={(event) => setIssueQuery(event.target.value)} placeholder="搜索问题、位置或修改理由" value={issueQuery} /></div><label>严重程度<select onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} value={severityFilter}><option value="all">全部</option><option value="major">Major</option><option value="minor">Minor</option><option value="suggestion">Suggestion</option></select></label><label>来源 Agent<select onChange={(event) => setAgentFilter(event.target.value as AgentFilter)} value={agentFilter}><option value="all">全部</option>{AGENTS.map((agent) => <option key={agent.id} value={agent.id}>{AGENT_LABELS[agent.id]}</option>)}</select></label><button onClick={toggleAllIssues} type="button">{filteredIssues.length > 0 && filteredIssues.every((issue) => expandedIssueIds.includes(issue.id)) ? '全部收起' : '全部展开'}</button><span>显示 {filteredIssues.length} / {result.issues.length}</span></div><div className="sf-issue-list">{filteredIssues.map((issue, index) => { const expanded = expandedIssueIds.includes(issue.id); return <article className={`sf-issue-card severity-${issue.severity} ${expanded ? 'is-expanded' : ''}`} key={issue.id}><button aria-expanded={expanded} className="sf-issue-summary" onClick={() => toggleIssue(issue.id)} type="button"><span className="sf-issue-number">{String(index + 1).padStart(2, '0')}</span><span className="sf-issue-main"><span><i>{AGENT_LABELS[issue.agent]}</i><i>{severityChinese(issue.severity)}</i><i>{issue.location}</i></span><b>{issue.category}</b><small>{issue.reason}</small></span><span className="sf-issue-expand"><Icon name="chevron" size={18} /></span></button>{expanded ? <div className="sf-issue-detail"><div className="sf-change-grid"><div><span>Original</span><p>{issue.original || 'No original excerpt supplied.'}</p></div><div><span>Suggested revision</span><p>{issue.revised || 'Author action required.'}</p></div></div><div className={issue.meaningChanged ? 'sf-meaning is-warning' : 'sf-meaning'}><Icon name={issue.meaningChanged ? 'alert' : 'shield'} size={16} />{issue.meaningChanged ? '该建议可能影响科学含义，请作者重点核对。' : '该建议未被 Agent 标记为科学含义变化。'}</div></div> : null}</article>; })}{!filteredIssues.length ? <div className="sf-empty"><Icon name="search" size={25} /><b>没有匹配的问题</b><span>调整搜索词或筛选条件后再查看。</span></div> : null}</div></div> : null}

                  {activeTab === 'terms' ? <div className="sf-term-grid">{result.terminology.length ? result.terminology.map((term, index) => <article className="sf-term-card" key={`${term.preferred}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><h3>{term.preferred}</h3>{term.avoid.length ? <div><b>避免混用</b>{term.avoid.join(' · ')}</div> : null}<p>{term.note}</p></article>) : <div className="sf-empty"><Icon name="check" size={25} /><b>本段未生成额外术语规则</b><span>术语 Agent 没有发现需要建立的统一表达。</span></div>}</div> : null}

                  {activeTab === 'trace' ? <div className="sf-trace-grid">{result.agentRuns.map((run) => <article className={`sf-trace-card status-${run.status}`} key={run.agent}><header><span>{AGENTS.find((agent) => agent.id === run.agent)?.short}</span><div><b>{AGENT_LABELS[run.agent]}</b><small>{run.model}</small></div><i>{run.status}</i></header><p>{run.summary}</p><div><span><Icon name="clock" size={15} />耗时 <b>{formatDuration(run.durationMs)}</b></span><span><Icon name="alert" size={15} />问题 <b>{run.issueCount}</b></span></div>{run.error ? <small><Icon name="alert" size={15} />{run.error}</small> : null}</article>)}</div> : null}
                </div>
              </section>
            ) : !loading ? <section className="sf-empty-workspace"><div><span>T</span><span>A</span><span>L</span><span>M</span><i><Icon name="spark" size={24} /></i></div><section><div className="sf-kicker">Evidence workspace</div><h2>审校结果会在这里形成完整证据链</h2><p>包括原文对照、作者待办、问题分级、术语规则和四个 Agent 的真实运行轨迹。</p></section></section> : null}
          </div>

          <div className={`sf-mobile-summary sf-mobile-section ${mobileView === 'export' ? 'is-mobile-active' : ''}`}><SummaryColumn actionCount={actionItems.length} failedAgents={failedAgents} issueCounts={issueCounts} majorIssues={majorIssues} onCopyActions={copyActions} onDownload={downloadArtifact} result={result} /></div>
        </section>

        <aside className="sf-right-rail"><SummaryColumn actionCount={actionItems.length} failedAgents={failedAgents} issueCounts={issueCounts} majorIssues={majorIssues} onCopyActions={copyActions} onDownload={downloadArtifact} result={result} /></aside>
      </div>

      <footer className="sf-footer"><span>ScholarForge OS · Evidence-aware academic writing</span><span>Powered by Alibaba Cloud Model Studio · {health.model}</span><a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">查看开源仓库 <Icon name="external" size={14} /></a></footer>
    </main>
  );
}
