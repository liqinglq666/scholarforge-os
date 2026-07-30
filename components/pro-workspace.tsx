'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SAMPLE_MANUSCRIPT } from '@/lib/demo-review';
import type {
  AgentId,
  IssueDecision,
  ReviewIssue,
  ReviewMode,
  ReviewResult,
  ReviewSection,
} from '@/lib/types';

const DRAFT_KEY = 'scholarforge-os-review-draft-v2';
const HISTORY_KEY = 'scholarforge-os-review-history-v1';
const MAX_HISTORY = 8;

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

const SECTION_OPTIONS: Array<{ id: ReviewSection; label: string; hint: string }> = [
  { id: 'general', label: '通用段落', hint: '综合审查' },
  { id: 'abstract', label: '摘要', hint: '信息密度与结论边界' },
  { id: 'introduction', label: '引言', hint: '研究缺口与目标逻辑' },
  { id: 'methods', label: '方法', hint: '可重复性与报告完整性' },
  { id: 'results', label: '结果', hint: '客观陈述与统计表达' },
  { id: 'discussion', label: '讨论', hint: '机制、局限与证据边界' },
  { id: 'conclusion', label: '结论', hint: '凝练与避免过度外推' },
];

const MODE_OPTIONS: Array<{ id: ReviewMode; label: string; hint: string }> = [
  { id: 'conservative', label: '保守审校', hint: '最小改动，优先保持作者声音' },
  { id: 'balanced', label: '平衡审校', hint: '语言质量与科学谨慎兼顾' },
  { id: 'deep', label: '深度审校', hint: '发现更多逻辑、方法与一致性风险' },
];

const DECISION_LABELS: Record<IssueDecision, string> = {
  pending: '待处理',
  accepted: '接受建议',
  deferred: '暂缓处理',
  dismissed: '忽略建议',
};

const DEFAULT_GUARDRAILS = [
  { id: 'numbers', label: '不新增原文不存在的数值与试验结果', passed: true },
  { id: 'meaning', label: '不把语言润色伪装为科学结论修改', passed: true },
  { id: 'missing-info', label: '缺失信息保留为作者待补项', passed: true },
];

type ResultTab = 'comparison' | 'actions' | 'issues' | 'terms' | 'trace' | 'history';
type SeverityFilter = 'all' | ReviewIssue['severity'];
type AgentFilter = 'all' | AgentId;
type DecisionFilter = 'all' | IssueDecision;
type MobileView = 'compose' | 'review' | 'issues' | 'export';

type ReviewPayload = ReviewResult & { error?: string; detail?: string; requestId?: string };
type HealthPayload = { version?: string; model?: string; modelStudioConfigured?: boolean };
type HealthState = { state: 'checking' | 'configured' | 'demo' | 'offline'; label: string; model: string; version: string };

type IssueDecisions = Record<string, IssueDecision>;

interface ReviewSnapshot {
  id: string;
  projectTitle: string;
  sourceText: string;
  targetJournal: string;
  sectionType: ReviewSection;
  reviewMode: ReviewMode;
  requestId: string;
  result: ReviewResult;
  decisions: IssueDecisions;
  savedAt: string;
}

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
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    save: <><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6M12 7v5l3 2" /></>,
    github: <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.2-4.7-5A3.9 3.9 0 0 1 7.7 9c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1.1a9.7 9.7 0 0 1 5.1 0c2-1.4 2.8-1.1 2.8-1.1.6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.7 5 .4.3.7 1 .7 2V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />,
  };

  return <svg aria-hidden="true" className="sf-icon" fill="none" height={size} viewBox="0 0 24 24" width={size}><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name] ?? paths.spark}</g></svg>;
}

function decisionMeta(decision?: ReviewResult['decision']) {
  if (decision === 'ready') return { label: 'Ready for Submission', zh: '可投稿', tone: 'ready' };
  if (decision === 'minor_revision') return { label: 'Minor Revision', zh: '建议小修', tone: 'minor' };
  if (decision === 'major_revision') return { label: 'Major Revision', zh: '建议大修', tone: 'major' };
  return { label: 'Awaiting Review', zh: '等待审校', tone: 'pending' };
}

function severityChinese(severity: ReviewIssue['severity']) {
  if (severity === 'major') return '重大问题';
  if (severity === 'minor') return '一般问题';
  return '优化建议';
}

function formatDuration(durationMs: number) {
  return durationMs < 1_000 ? `${durationMs} ms` : `${(durationMs / 1_000).toFixed(1)} s`;
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function safeFileStem(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'scholarforge-review';
}

function buildDecisionLog(result: ReviewResult, decisions: IssueDecisions) {
  return result.issues.map((issue, index) => [
    `## ${index + 1}. ${issue.category}`,
    `- Decision: ${DECISION_LABELS[decisions[issue.id] || 'pending']}`,
    `- Agent: ${AGENT_LABELS[issue.agent]}`,
    `- Severity: ${issue.severity}`,
    `- Location: ${issue.location}`,
    `- Original: ${issue.original || 'Not supplied'}`,
    `- Suggested revision: ${issue.revised || 'Author action required'}`,
    `- Reason: ${issue.reason}`,
  ].join('\n')).join('\n\n');
}

function buildMarkdownReport(result: ReviewResult, source: string, requestId: string, decisions: IssueDecisions) {
  const traces = result.agentRuns.map((run) => `- ${AGENT_LABELS[run.agent]}: ${run.status}, ${formatDuration(run.durationMs)}, ${run.issueCount} issues, model=${run.model}`).join('\n');
  const terms = result.terminology.length
    ? result.terminology.map((term) => `- **${term.preferred}** — ${term.note}${term.avoid.length ? `; avoid: ${term.avoid.join(', ')}` : ''}`).join('\n')
    : '- No terminology rules generated.';

  return `# ScholarForge OS Academic English Review\n\n` +
    `- Project: ${result.profile.projectTitle}\n` +
    `- Target journal: ${result.profile.targetJournal || 'Not specified'}\n` +
    `- Section: ${result.profile.sectionType}\n` +
    `- Review mode: ${result.profile.reviewMode}\n` +
    `- Request ID: ${requestId || 'Not available'}\n` +
    `- Generated at: ${result.generatedAt}\n` +
    `- Workflow: ${result.workflowVersion} (${result.executionMode})\n` +
    `- Decision: ${decisionMeta(result.decision).label}\n` +
    `- Score: ${result.scoreBefore} → ${result.scoreAfter}\n\n` +
    `## Executive summary\n\n${result.summary}\n\n` +
    `## Decision rationale\n\n${result.decisionReason}\n\n` +
    `## Author decision log\n\n${buildDecisionLog(result, decisions)}\n\n` +
    `## Agent execution trace\n\n${traces}\n\n` +
    `## Terminology glossary\n\n${terms}\n\n` +
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
  decisions,
  onDownload,
}: {
  result: ReviewResult | null;
  decisions: IssueDecisions;
  onDownload: (kind: 'revision' | 'report' | 'json' | 'decisions') => void;
}) {
  const decision = decisionMeta(result?.decision);
  const score = result?.scoreAfter ?? 0;
  const decisionCounts = useMemo(() => ({
    accepted: Object.values(decisions).filter((value) => value === 'accepted').length,
    deferred: Object.values(decisions).filter((value) => value === 'deferred').length,
    dismissed: Object.values(decisions).filter((value) => value === 'dismissed').length,
    pending: result ? result.issues.filter((issue) => (decisions[issue.id] || 'pending') === 'pending').length : 0,
  }), [decisions, result]);

  return <div className="sf-summary-stack">
    <section className={`sf-summary-card sf-readiness tone-${decision.tone}`}>
      <div className="sf-kicker">Submission readiness</div>
      <div className="sf-readiness-head"><div><span className="sf-decision-zh">{decision.zh}</span><h2>{decision.label}</h2><p>{result ? `${result.scoreBefore} → ${result.scoreAfter}` : '完成审校后生成判断'}</p></div><div className="sf-score-ring" style={{ '--score-angle': `${score * 3.6}deg` } as CSSProperties}><div><strong>{result ? score : '—'}</strong><span>/ 100</span></div></div></div>
      <div className="sf-decision-summary">{result ? result.summary : '评分与 Decision 由代码根据规范化问题集计算。'}</div>
      {result ? <p className="sf-decision-reason">{result.decisionReason}</p> : null}
    </section>

    <section className="sf-summary-card">
      <div className="sf-card-head"><div><div className="sf-kicker">Author decisions</div><h3>作者处理进度</h3></div><span>{result?.issues.length ?? 0}</span></div>
      <div className="sf-decision-metrics">
        <div className="is-accepted"><span>已接受</span><strong>{decisionCounts.accepted}</strong></div>
        <div className="is-deferred"><span>暂缓</span><strong>{decisionCounts.deferred}</strong></div>
        <div className="is-dismissed"><span>忽略</span><strong>{decisionCounts.dismissed}</strong></div>
        <div><span>待处理</span><strong>{decisionCounts.pending}</strong></div>
      </div>
    </section>

    <section className="sf-summary-card">
      <div className="sf-kicker">Deliverables</div><h3>审校交付物</h3><p className="sf-card-copy">文件由浏览器即时生成，包含章节、模式与作者决策。</p>
      <div className="sf-deliverables">
        <button disabled={!result} onClick={() => onDownload('revision')} type="button"><i>TXT</i><span><b>Revised Manuscript</b><small>保守修改稿</small></span><Icon name="download" size={17} /></button>
        <button disabled={!result} onClick={() => onDownload('report')} type="button"><i>MD</i><span><b>Audit Report</b><small>完整审校报告</small></span><Icon name="download" size={17} /></button>
        <button disabled={!result} onClick={() => onDownload('decisions')} type="button"><i>LOG</i><span><b>Decision Log</b><small>作者决策日志</small></span><Icon name="download" size={17} /></button>
        <button disabled={!result} onClick={() => onDownload('json')} type="button"><i>JSON</i><span><b>Review Evidence</b><small>结构化证据</small></span><Icon name="download" size={17} /></button>
      </div>
    </section>
  </div>;
}

export function ProWorkspace() {
  const [projectTitle, setProjectTitle] = useState('NMR manuscript review');
  const [text, setText] = useState(SAMPLE_MANUSCRIPT);
  const [targetJournal, setTargetJournal] = useState('Construction and Building Materials');
  const [sectionType, setSectionType] = useState<ReviewSection>('methods');
  const [reviewMode, setReviewMode] = useState<ReviewMode>('balanced');
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [requestId, setRequestId] = useState('');
  const [decisions, setDecisions] = useState<IssueDecisions>({});
  const [history, setHistory] = useState<ReviewSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<ResultTab>('comparison');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [issueQuery, setIssueQuery] = useState('');
  const [expandedIssueIds, setExpandedIssueIds] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<MobileView>('compose');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [health, setHealth] = useState<HealthState>({ state: 'checking', label: '正在检查百炼配置', model: 'qwen-plus', version: '0.7.0' });

  useEffect(() => {
    try {
      const draftRaw = window.localStorage.getItem(DRAFT_KEY);
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as Partial<{
          projectTitle: string; text: string; targetJournal: string; sectionType: ReviewSection; reviewMode: ReviewMode; savedAt: string;
        }>;
        if (draft.projectTitle) setProjectTitle(draft.projectTitle);
        if (draft.text?.trim()) setText(draft.text);
        if (typeof draft.targetJournal === 'string') setTargetJournal(draft.targetJournal);
        if (draft.sectionType) setSectionType(draft.sectionType);
        if (draft.reviewMode) setReviewMode(draft.reviewMode);
        if (draft.savedAt) setDraftSavedAt(draft.savedAt);
      }
      const historyRaw = window.localStorage.getItem(HISTORY_KEY);
      if (historyRaw) setHistory(JSON.parse(historyRaw) as ReviewSnapshot[]);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
      window.localStorage.removeItem(HISTORY_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ projectTitle, text, targetJournal, sectionType, reviewMode, savedAt }));
      setDraftSavedAt(savedAt);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftReady, projectTitle, reviewMode, sectionType, targetJournal, text]);

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
        setHealth({ state: configured ? 'configured' : 'demo', label: configured ? '百炼服务端已配置' : '安全演示模式', model: payload.model || 'qwen-plus', version: payload.version || '0.7.0' });
      })
      .catch(() => alive && setHealth({ state: 'offline', label: '服务状态暂不可用', model: 'qwen-plus', version: '0.7.0' }));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 120);
    return () => window.clearInterval(timer);
  }, [loading]);

  const inputValid = text.trim().length >= 40 && text.length <= 12_000;
  const saveLabel = draftSavedAt ? `草稿已保存 · ${new Date(draftSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '草稿将在本机自动保存';

  const actionItems = useMemo(() => result?.issues.filter((issue) => issue.severity === 'major' || issue.agent === 'method' || issue.agent === 'logic' || issue.revised.includes('[Please provide')) ?? [], [result]);

  const filteredIssues = useMemo(() => {
    const priority: Record<ReviewIssue['severity'], number> = { major: 0, minor: 1, suggestion: 2 };
    const query = issueQuery.trim().toLowerCase();
    return (result?.issues ?? [])
      .filter((issue) => severityFilter === 'all' || issue.severity === severityFilter)
      .filter((issue) => agentFilter === 'all' || issue.agent === agentFilter)
      .filter((issue) => decisionFilter === 'all' || (decisions[issue.id] || 'pending') === decisionFilter)
      .filter((issue) => !query || [issue.category, issue.location, issue.reason, issue.original, issue.revised].join(' ').toLowerCase().includes(query))
      .slice()
      .sort((a, b) => priority[a.severity] - priority[b.severity]);
  }, [agentFilter, decisionFilter, decisions, issueQuery, result, severityFilter]);

  async function handleReview() {
    if (loading || !inputValid) return;
    setLoading(true);
    setElapsedMs(0);
    setError('');
    setResult(null);
    setRequestId('');
    setDecisions({});
    setActiveTab('comparison');
    setMobileView('review');
    setExpandedIssueIds([]);

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectTitle, text, targetJournal, sectionType, reviewMode }),
      });
      const payload = await response.json() as ReviewPayload;
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Review request failed.');
      const nextDecisions = Object.fromEntries(payload.issues.map((issue) => [issue.id, 'pending'])) as IssueDecisions;
      const nextRequestId = payload.requestId || '';
      setResult(payload);
      setRequestId(nextRequestId);
      setDecisions(nextDecisions);

      const snapshot: ReviewSnapshot = {
        id: crypto.randomUUID(),
        projectTitle: projectTitle.trim() || 'Untitled manuscript review',
        sourceText: text,
        targetJournal,
        sectionType,
        reviewMode,
        requestId: nextRequestId,
        result: payload,
        decisions: nextDecisions,
        savedAt: new Date().toISOString(),
      };
      setHistory((current) => {
        const next = [snapshot, ...current].slice(0, MAX_HISTORY);
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '审校失败，请检查配置后重试。');
      setMobileView('compose');
    } finally {
      setLoading(false);
    }
  }

  function updateIssueDecision(issueId: string, value: IssueDecision) {
    setDecisions((current) => {
      const next = { ...current, [issueId]: value };
      setHistory((items) => {
        if (!result) return items;
        const updated = items.map((item, index) => index === 0 && item.result.generatedAt === result.generatedAt ? { ...item, decisions: next } : item);
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
      return next;
    });
  }

  function startNewReview() {
    setProjectTitle('');
    setText('');
    setTargetJournal('');
    setSectionType('general');
    setReviewMode('balanced');
    setResult(null);
    setRequestId('');
    setDecisions({});
    setActiveTab('comparison');
    setMobileView('compose');
    setError('');
    window.localStorage.removeItem(DRAFT_KEY);
    setDraftSavedAt('');
    window.requestAnimationFrame(() => document.getElementById('sf-project-title')?.focus());
  }

  function restoreSample() {
    setProjectTitle('NMR manuscript review');
    setText(SAMPLE_MANUSCRIPT);
    setTargetJournal('Construction and Building Materials');
    setSectionType('methods');
    setReviewMode('balanced');
    setResult(null);
    setDecisions({});
    setMobileView('compose');
  }

  function restoreSnapshot(snapshot: ReviewSnapshot) {
    setProjectTitle(snapshot.projectTitle);
    setText(snapshot.sourceText);
    setTargetJournal(snapshot.targetJournal);
    setSectionType(snapshot.sectionType);
    setReviewMode(snapshot.reviewMode);
    setResult(snapshot.result);
    setRequestId(snapshot.requestId);
    setDecisions(snapshot.decisions);
    setActiveTab('comparison');
    setMobileView('review');
  }

  function deleteSnapshot(id: string) {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== id);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function copyText(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
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

  function downloadArtifact(kind: 'revision' | 'report' | 'json' | 'decisions') {
    if (!result) return;
    const stem = safeFileStem(projectTitle || targetJournal);
    if (kind === 'revision') return downloadText(`${stem}-revised.txt`, result.revisedText, 'text/plain;charset=utf-8');
    if (kind === 'report') return downloadText(`${stem}-audit-report.md`, buildMarkdownReport(result, text, requestId, decisions), 'text/markdown;charset=utf-8');
    if (kind === 'decisions') return downloadText(`${stem}-author-decisions.md`, `# Author Decision Log\n\n${buildDecisionLog(result, decisions)}\n`, 'text/markdown;charset=utf-8');
    downloadText(`${stem}-review-result.json`, JSON.stringify({ projectTitle, sourceText: text, requestId, decisions, ...result }, null, 2), 'application/json;charset=utf-8');
  }

  const resultTabs: Array<{ id: ResultTab; label: string; count?: number }> = [
    { id: 'comparison', label: '对照审校' },
    { id: 'actions', label: '作者待办', count: actionItems.length },
    { id: 'issues', label: '问题决策', count: result?.issues.length ?? 0 },
    { id: 'terms', label: '术语库', count: result?.terminology.length ?? 0 },
    { id: 'trace', label: '运行轨迹', count: result?.agentRuns.length ?? 0 },
    { id: 'history', label: '审校历史', count: history.length },
  ];

  return <main className="sf-shell">
    <header className="sf-topbar"><div className="sf-topbar-inner">
      <a className="sf-brand" href="#sf-workspace" aria-label="ScholarForge OS 首页"><span className="sf-brand-mark">S</span><span><strong>ScholarForge OS <i>｜研语工坊</i></strong><small>Evidence-aware academic writing workspace</small></span></a>
      <nav className="sf-desktop-nav" aria-label="主要导航"><a href="#sf-workspace">审校工作台</a><button className="sf-nav-button" onClick={() => { setActiveTab('history'); setMobileView('review'); }} type="button">审校历史</button><a href="https://github.com/liqinglq666/scholarforge-os/blob/main/docs/PRD.md" rel="noreferrer" target="_blank">产品路线</a><a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank"><Icon name="github" size={16} />GitHub</a></nav>
      <div className="sf-topbar-actions"><button className="sf-new-review" onClick={startNewReview} type="button"><Icon name="plus" size={16} />新建审校</button><div className={`sf-service-status is-${health.state}`}><span />{health.label}</div><span className="sf-version">v{health.version}</span></div>
    </div></header>

    <nav className="sf-mobile-nav" aria-label="移动端工作区导航">
      <button aria-current={mobileView === 'compose'} onClick={() => setMobileView('compose')} type="button"><Icon name="document" size={18} />输入</button>
      <button aria-current={mobileView === 'review'} onClick={() => setMobileView('review')} type="button"><Icon name="spark" size={18} />结果</button>
      <button aria-current={mobileView === 'issues'} onClick={() => { setMobileView('issues'); setActiveTab('issues'); }} type="button"><Icon name="alert" size={18} />决策<i>{result?.issues.length ?? 0}</i></button>
      <button aria-current={mobileView === 'export'} onClick={() => setMobileView('export')} type="button"><Icon name="download" size={18} />导出</button>
    </nav>

    <div className="sf-workspace" id="sf-workspace">
      <aside className="sf-left-rail">
        <section className="sf-rail-card sf-project-card"><div className="sf-kicker">Current project</div><h2>{projectTitle || '未命名论文项目'}</h2><p>章节感知审校、作者决策和历史快照均围绕当前项目保存。</p><div className="sf-project-ticket"><span>Active review</span><strong>{targetJournal || '未指定目标期刊'}</strong><small>{SECTION_OPTIONS.find((item) => item.id === sectionType)?.label} · {MODE_OPTIONS.find((item) => item.id === reviewMode)?.label}</small></div><div className="sf-draft-state"><Icon name="save" size={15} /><span>{saveLabel}</span></div></section>
        <section className="sf-rail-card"><div className="sf-rail-head"><div><div className="sf-kicker">Agent team</div><h3>并行专家组</h3></div><span>4</span></div><div className="sf-agent-list" aria-live="polite">{AGENTS.map((agent) => { const run = result?.agentRuns.find((item) => item.agent === agent.id); const done = run?.status === 'completed' || run?.status === 'demo'; return <div className={`sf-agent-row ${done ? 'is-done' : ''} ${loading ? 'is-running' : ''} ${run?.status === 'failed' ? 'is-failed' : ''}`} key={agent.id}><span className="sf-agent-avatar">{done ? <Icon name="check" size={15} /> : agent.short}</span><span className="sf-agent-copy"><b>{agent.name}</b><small>{agent.role}</small></span><span className="sf-agent-state">{done && run ? formatDuration(run.durationMs) : loading ? '运行中' : '等待'}</span></div>; })}</div></section>
        <section className="sf-rail-card"><div className="sf-kicker">Scientific guardrails</div><h3>科研安全边界</h3><div className="sf-guardrail-list">{(result?.guardrails || DEFAULT_GUARDRAILS).map((guardrail) => <div className={guardrail.passed ? 'is-passed' : 'is-warning'} key={guardrail.id}><span>{guardrail.passed ? <Icon name="check" size={15} /> : <Icon name="alert" size={15} />}</span><p>{guardrail.label}</p></div>)}</div></section>
        <section className="sf-rail-card sf-history-rail"><div className="sf-rail-head"><div><div className="sf-kicker">Local history</div><h3>最近审校</h3></div><span>{history.length}</span></div>{history.slice(0, 3).map((snapshot) => <button key={snapshot.id} onClick={() => restoreSnapshot(snapshot)} type="button"><b>{snapshot.projectTitle}</b><small>{snapshot.result.scoreAfter}/100 · {new Date(snapshot.savedAt).toLocaleDateString('zh-CN')}</small></button>)}{!history.length ? <p>完成第一次审校后，这里会保存本机历史。</p> : null}</section>
      </aside>

      <section className="sf-main-column">
        <div className={`sf-mobile-section ${mobileView === 'compose' ? 'is-mobile-active' : ''}`}>
          <section className="sf-hero"><div className="sf-hero-copy"><div className="sf-hero-eyebrow"><span />Section-aware manuscript review</div><h1>从“润色一段话”，升级为<em>管理一次论文审校。</em></h1><p>先定义论文项目、章节和审校强度，再由四个 Agent 并行检查；审校完成后由作者逐条决定。</p></div><div className="sf-assurance"><Icon name="shield" size={22} /><span><b>Scientific meaning protected</b><small>科学含义保护开启</small></span></div><ol className="sf-steps"><li className="is-current"><span>01</span><div><b>定义任务</b><small>项目、章节与模式</small></div></li><li className={loading ? 'is-current' : result ? 'is-complete' : ''}><span>02</span><div><b>并行审查</b><small>4 个独立 Agent</small></div></li><li className={result ? 'is-current' : ''}><span>03</span><div><b>作者决策</b><small>接受、暂缓或忽略</small></div></li></ol></section>

          <section className="sf-composer">
            <div className="sf-section-head"><div><span>01</span><div><div className="sf-kicker">Review setup</div><h2>配置论文审校任务</h2></div></div><div className={inputValid ? 'sf-length is-valid' : 'sf-length is-invalid'}><b>{text.length.toLocaleString()} / 12,000</b><small>{inputValid ? `${wordCount(text)} words · 可以开始审校` : '至少输入 40 个字符'}</small></div></div>
            <div className="sf-profile-grid">
              <div className="sf-field"><label htmlFor="sf-project-title">项目名称</label><div className="sf-input-shell"><Icon name="document" size={18} /><input id="sf-project-title" onChange={(event) => setProjectTitle(event.target.value)} placeholder="例如：Underwater ECC manuscript" value={projectTitle} /></div></div>
              <div className="sf-field"><label htmlFor="sf-journal">目标期刊 <span>可选</span></label><div className="sf-input-shell"><Icon name="document" size={18} /><input id="sf-journal" onChange={(event) => setTargetJournal(event.target.value)} placeholder="例如：Construction and Building Materials" value={targetJournal} /></div></div>
            </div>
            <div className="sf-profile-grid sf-profile-grid-selects">
              <label className="sf-select-field">论文章节<select onChange={(event) => setSectionType(event.target.value as ReviewSection)} value={sectionType}>{SECTION_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.hint}</option>)}</select></label>
              <label className="sf-select-field">审校强度<select onChange={(event) => setReviewMode(event.target.value as ReviewMode)} value={reviewMode}>{MODE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.hint}</option>)}</select></label>
            </div>
            <div className="sf-review-profile-note"><Icon name="spark" size={17} /><div><b>{SECTION_OPTIONS.find((item) => item.id === sectionType)?.label} · {MODE_OPTIONS.find((item) => item.id === reviewMode)?.label}</b><span>{SECTION_OPTIONS.find((item) => item.id === sectionType)?.hint}；{MODE_OPTIONS.find((item) => item.id === reviewMode)?.hint}。</span></div></div>
            <div className="sf-field"><label htmlFor="sf-manuscript">科研英文段落</label><textarea id="sf-manuscript" onChange={(event) => setText(event.target.value)} placeholder="Paste an English manuscript passage here..." spellCheck={false} value={text} /><div className="sf-text-meta"><span><Icon name="save" size={14} />{saveLabel}</span><span><Icon name="shield" size={14} />模型仅在服务端调用</span></div></div>
            <div className="sf-composer-actions"><div><button className="sf-ghost-button" onClick={restoreSample} type="button"><Icon name="refresh" size={16} />恢复示例</button><button className="sf-ghost-button danger" onClick={startNewReview} type="button"><Icon name="trash" size={16} />清空</button></div><button className="sf-primary-button" disabled={loading || !inputValid} onClick={handleReview} type="button">{loading ? <><span className="sf-spinner" />4 个 Agent 正在并行审校</> : <><Icon name="spark" size={18} />启动{MODE_OPTIONS.find((item) => item.id === reviewMode)?.label}<Icon name="chevron" size={17} /></>}</button></div>
            <div aria-live="assertive">{error ? <div className="sf-error"><Icon name="alert" size={18} /><div><b>审校请求未完成</b><span>{error}</span></div><button onClick={handleReview} type="button">重试</button></div> : null}</div>
          </section>
        </div>

        <div className={`sf-mobile-section ${mobileView === 'review' || mobileView === 'issues' ? 'is-mobile-active' : ''}`}>
          {(loading || result) ? <section className={`sf-workflow-status ${loading ? 'is-loading' : 'is-complete'}`} aria-live="polite"><div className="sf-workflow-head"><span className="sf-workflow-icon">{loading ? <span className="sf-spinner" /> : <Icon name="check" size={18} />}</span><div><b>{loading ? '四个专业 Agent 已同时发出请求' : '审校工作流已完成'}</b><small>{loading ? `已等待 ${(elapsedMs / 1_000).toFixed(1)} 秒` : `${sectionType} · ${reviewMode} · Workflow ${result?.workflowVersion}${requestId ? ` · ${requestId}` : ''}`}</small></div><span><Icon name="clock" size={16} />{loading ? `${(elapsedMs / 1_000).toFixed(1)} s` : '完成'}</span></div><div className="sf-workflow-track"><i /></div></section> : null}

          {result ? <section className="sf-results">
            <div className="sf-results-head"><div><span>02</span><div><div className="sf-kicker">Review evidence</div><h2>审校结果与作者决策</h2></div></div><div className="sf-results-actions"><span className={`sf-live-mode ${result.mode === 'live' ? 'is-live' : 'is-demo'}`}><i />{result.mode === 'live' ? `百炼真实多 Agent · ${health.model}` : '安全演示模式'}</span><button onClick={handleReview} type="button"><Icon name="refresh" size={15} />重新审校</button></div></div>
            <div className="sf-tabs" role="tablist">{resultTabs.map((tab) => <button aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'is-active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">{tab.label}{tab.count !== undefined ? <span>{tab.count}</span> : null}</button>)}</div>
            <div className="sf-result-body">
              {activeTab === 'comparison' ? <div className="sf-comparison"><div className="sf-comparison-toolbar"><div><span>{wordCount(text)} → {wordCount(result.revisedText)} words</span><span>{SECTION_OPTIONS.find((item) => item.id === result.profile.sectionType)?.label}</span><span>{MODE_OPTIONS.find((item) => item.id === result.profile.reviewMode)?.label}</span></div><button onClick={() => copyText(result.revisedText, 'revision')} type="button"><Icon name="copy" size={16} />{copied === 'revision' ? '已复制' : '复制修改稿'}</button></div><div className="sf-paper-grid"><article className="sf-paper"><header><div><span>Original manuscript</span><b>原始文本</b></div><small>{wordCount(text)} words</small></header><p>{text}</p></article><article className="sf-paper is-revised"><header><div><span>ScholarForge revision</span><b>保守修改稿</b></div><small>{wordCount(result.revisedText)} words</small></header><p>{result.revisedText}</p></article></div></div> : null}

              {activeTab === 'actions' ? <div className="sf-actions-view"><div className="sf-action-intro"><div><div className="sf-kicker">Author action list</div><h3>先处理这些，再继续投稿</h3><p>Major、逻辑、方法和待补信息问题会自动归纳。</p></div><button onClick={() => copyText(buildDecisionLog(result, decisions), 'actions')} type="button"><Icon name="copy" size={16} />{copied === 'actions' ? '已复制' : '复制决策清单'}</button></div><div className="sf-action-list">{actionItems.map((issue, index) => <article key={issue.id}><span>{String(index + 1).padStart(2, '0')}</span><div><div><i>{AGENT_LABELS[issue.agent]}</i><i>{severityChinese(issue.severity)}</i><i>{DECISION_LABELS[decisions[issue.id] || 'pending']}</i></div><h4>{issue.category}</h4><p>{issue.reason}</p><small>{issue.revised || '请作者补充、核对或重新表述。'}</small></div></article>)}</div></div> : null}

              {activeTab === 'issues' ? <div className="sf-issues-view"><div className="sf-filter-bar"><div className="sf-search-shell"><Icon name="search" size={16} /><input onChange={(event) => setIssueQuery(event.target.value)} placeholder="搜索问题、位置或修改理由" value={issueQuery} /></div><label>严重程度<select onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} value={severityFilter}><option value="all">全部</option><option value="major">Major</option><option value="minor">Minor</option><option value="suggestion">Suggestion</option></select></label><label>来源 Agent<select onChange={(event) => setAgentFilter(event.target.value as AgentFilter)} value={agentFilter}><option value="all">全部</option>{AGENTS.map((agent) => <option key={agent.id} value={agent.id}>{AGENT_LABELS[agent.id]}</option>)}</select></label><label>作者决策<select onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)} value={decisionFilter}><option value="all">全部</option><option value="pending">待处理</option><option value="accepted">已接受</option><option value="deferred">暂缓</option><option value="dismissed">忽略</option></select></label><button onClick={toggleAllIssues} type="button">全部展开/收起</button></div><div className="sf-issue-list">{filteredIssues.map((issue, index) => { const expanded = expandedIssueIds.includes(issue.id); const issueDecision = decisions[issue.id] || 'pending'; return <article className={`sf-issue-card severity-${issue.severity} decision-${issueDecision} ${expanded ? 'is-expanded' : ''}`} key={issue.id}><button aria-expanded={expanded} className="sf-issue-summary" onClick={() => toggleIssue(issue.id)} type="button"><span className="sf-issue-number">{String(index + 1).padStart(2, '0')}</span><span className="sf-issue-main"><span><i>{AGENT_LABELS[issue.agent]}</i><i>{severityChinese(issue.severity)}</i><i className={`sf-decision-chip is-${issueDecision}`}>{DECISION_LABELS[issueDecision]}</i></span><b>{issue.category}</b><small>{issue.reason}</small></span><span className="sf-issue-expand"><Icon name="chevron" size={18} /></span></button>{expanded ? <div className="sf-issue-detail"><div className="sf-change-grid"><div><span>Original</span><p>{issue.original || 'No original excerpt supplied.'}</p></div><div><span>Suggested revision</span><p>{issue.revised || 'Author action required.'}</p></div></div><div className="sf-decision-actions"><span>作者决策</span>{(['accepted', 'deferred', 'dismissed', 'pending'] as IssueDecision[]).map((value) => <button className={issueDecision === value ? 'is-active' : ''} key={value} onClick={() => updateIssueDecision(issue.id, value)} type="button">{DECISION_LABELS[value]}</button>)}</div><div className={issue.meaningChanged ? 'sf-meaning is-warning' : 'sf-meaning'}><Icon name={issue.meaningChanged ? 'alert' : 'shield'} size={16} />{issue.meaningChanged ? '该建议可能影响科学含义，请作者重点核对。' : '该建议未被 Agent 标记为科学含义变化。'}</div></div> : null}</article>; })}</div></div> : null}

              {activeTab === 'terms' ? <div className="sf-term-grid">{result.terminology.length ? result.terminology.map((term, index) => <article className="sf-term-card" key={`${term.preferred}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><h3>{term.preferred}</h3>{term.avoid.length ? <div><b>避免混用</b>{term.avoid.join(' · ')}</div> : null}<p>{term.note}</p></article>) : <div className="sf-empty"><Icon name="check" size={25} /><b>本段未生成额外术语规则</b></div>}</div> : null}
              {activeTab === 'trace' ? <div className="sf-trace-grid">{result.agentRuns.map((run) => <article className={`sf-trace-card status-${run.status}`} key={run.agent}><header><span>{AGENTS.find((agent) => agent.id === run.agent)?.short}</span><div><b>{AGENT_LABELS[run.agent]}</b><small>{run.model}</small></div><i>{run.status}</i></header><p>{run.summary}</p><div><span><Icon name="clock" size={15} />耗时 <b>{formatDuration(run.durationMs)}</b></span><span><Icon name="alert" size={15} />问题 <b>{run.issueCount}</b></span></div></article>)}</div> : null}
              {activeTab === 'history' ? <div className="sf-history-view"><div className="sf-action-intro"><div><div className="sf-kicker">Local review history</div><h3>本机审校快照</h3><p>最多保存最近 {MAX_HISTORY} 次审校；当前尚未同步到云端账户。</p></div></div>{history.length ? <div className="sf-history-list">{history.map((snapshot) => <article key={snapshot.id}><button onClick={() => restoreSnapshot(snapshot)} type="button"><span><b>{snapshot.projectTitle}</b><small>{SECTION_OPTIONS.find((item) => item.id === snapshot.sectionType)?.label} · {MODE_OPTIONS.find((item) => item.id === snapshot.reviewMode)?.label}</small></span><strong>{snapshot.result.scoreAfter}</strong><i>{new Date(snapshot.savedAt).toLocaleString('zh-CN')}</i></button><button aria-label="删除历史" onClick={() => deleteSnapshot(snapshot.id)} type="button"><Icon name="trash" size={16} /></button></article>)}</div> : <div className="sf-empty"><Icon name="history" size={25} /><b>还没有审校历史</b><span>完成审校后会自动保存到当前浏览器。</span></div>}</div> : null}
            </div>
          </section> : !loading ? <section className="sf-empty-workspace"><div><span>T</span><span>A</span><span>L</span><span>M</span><i><Icon name="spark" size={24} /></i></div><section><div className="sf-kicker">Evidence workspace</div><h2>一次审校不该停在“AI 帮我改过”</h2><p>完成审校后，你可以逐条决定、保存快照，并导出带作者决策的证据日志。</p></section></section> : null}
        </div>

        <div className={`sf-mobile-summary sf-mobile-section ${mobileView === 'export' ? 'is-mobile-active' : ''}`}><SummaryColumn decisions={decisions} onDownload={downloadArtifact} result={result} /></div>
      </section>

      <aside className="sf-right-rail"><SummaryColumn decisions={decisions} onDownload={downloadArtifact} result={result} /></aside>
    </div>

    <footer className="sf-footer"><span>ScholarForge OS · Evidence-aware academic writing</span><span>Powered by Alibaba Cloud Model Studio · {health.model}</span><a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">查看开源仓库 <Icon name="external" size={14} /></a></footer>
  </main>;
}
