'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  SAMPLE_CHINESE_MANUSCRIPT,
  SAMPLE_MANUSCRIPT,
  SAMPLE_RESPONSE_CONTEXT,
  SAMPLE_REVIEW_COMMENT,
} from '@/lib/demo-review';
import type {
  AgentId,
  IssueDecision,
  ReviewIssue,
  ReviewMode,
  ReviewResult,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

const APP_VERSION = '1.3.4';
const DRAFT_KEY = 'scholarforge-os-paperlens-draft-v1';
const HISTORY_KEY = 'scholarforge-os-paperlens-history-v1';
const MAX_HISTORY = 8;

const AGENTS: Array<{ id: AgentId; short: string; name: string; role: string }> = [
  { id: 'terminology', short: 'T', name: 'Terminology Guardian', role: '术语锁、缩写、单位与命名' },
  { id: 'language', short: 'A', name: 'Academic Editor', role: '翻译、润色或返修信主输出' },
  { id: 'logic', short: 'L', name: 'Logic Auditor', role: '证据边界、因果与回应完整性' },
  { id: 'method', short: 'M', name: 'Method Auditor', role: '方法、复现性与作者依据' },
];

const AGENT_LABELS: Record<AgentId, string> = {
  terminology: '术语审校',
  language: '语言审校',
  logic: '逻辑审校',
  method: '方法审校',
};

const TASK_OPTIONS: Array<{
  id: WorkspaceTask;
  label: string;
  eyebrow: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  placeholder: string;
  cta: string;
}> = [
  {
    id: 'translate',
    label: '科研中译英',
    eyebrow: 'Chinese → Academic English',
    description: '在保留数据、术语和科学语气的前提下，生成可投稿的英文初稿。',
    inputLabel: '中文科研原文',
    outputLabel: '学术英文译稿',
    placeholder: '粘贴中文摘要、方法、结果或讨论段落……',
    cta: '启动科研翻译',
  },
  {
    id: 'polish',
    label: '英文保守润色',
    eyebrow: 'Conservative polishing',
    description: '改善语法、搭配和学术语气，不新增实验事实，不扩大结论。',
    inputLabel: '英文论文原文',
    outputLabel: '保守修改稿',
    placeholder: 'Paste an English manuscript passage here...',
    cta: '启动英文润色',
  },
  {
    id: 'precheck',
    label: '投稿前预检',
    eyebrow: 'Reviewer-style precheck',
    description: '像预审编辑一样检查术语、语言、逻辑、方法和投稿准备度。',
    inputLabel: '待预检英文稿件',
    outputLabel: '预检修改稿',
    placeholder: 'Paste the manuscript passage to run a reviewer-style precheck...',
    cta: '启动投稿预检',
  },
  {
    id: 'review-response',
    label: '审稿回复助手',
    eyebrow: 'Response to reviewers',
    description: '基于作者提供的事实和拟修改内容，生成不虚构证据的正式返修信。',
    inputLabel: '审稿意见',
    outputLabel: 'Response to Reviewer 草稿',
    placeholder: '粘贴一条 Reviewer Comment，建议保留评论编号……',
    cta: '生成返修信草稿',
  },
];

const SECTION_OPTIONS: Array<{ id: ReviewSection; label: string; hint: string }> = [
  { id: 'general', label: '通用段落', hint: '综合审查' },
  { id: 'abstract', label: '摘要', hint: '结构、信息密度与结论边界' },
  { id: 'introduction', label: '引言', hint: '研究缺口、目标与创新边界' },
  { id: 'methods', label: '方法', hint: '可重复性与报告完整性' },
  { id: 'results', label: '结果', hint: '客观陈述与统计表达' },
  { id: 'discussion', label: '讨论', hint: '机制、局限与证据边界' },
  { id: 'conclusion', label: '结论', hint: '凝练与避免过度外推' },
];

const MODE_OPTIONS: Array<{ id: ReviewMode; label: string; hint: string }> = [
  { id: 'conservative', label: '保守模式', hint: '最小改动，优先保持作者声音' },
  { id: 'balanced', label: '平衡模式', hint: '语言质量与科学谨慎兼顾' },
  { id: 'deep', label: '深度模式', hint: '发现更多逻辑、方法和一致性风险' },
];

const DECISION_LABELS: Record<IssueDecision, string> = {
  pending: '待处理',
  accepted: '接受建议',
  deferred: '暂缓处理',
  dismissed: '忽略建议',
};

const DEFAULT_GUARDRAILS = [
  { id: 'numbers', label: '不新增来源与作者依据之外的数值', passed: true },
  { id: 'meaning', label: '不改变原有科学含义和证据强度', passed: true },
  { id: 'missing-info', label: '缺失信息保留为作者待补项', passed: true },
  { id: 'terminology-locks', label: '用户锁定术语必须被保留', passed: true },
];

type ResultTab = 'output' | 'actions' | 'issues' | 'facts' | 'terms' | 'trace';
type OutputView = 'split' | 'clean' | 'diff';
type SeverityFilter = 'all' | ReviewIssue['severity'];
type AgentFilter = 'all' | AgentId;
type DecisionFilter = 'all' | IssueDecision;
type MobileView = 'compose' | 'review' | 'issues' | 'export';
type IssueDecisions = Record<string, IssueDecision>;
type HealthState = {
  state: 'checking' | 'configured' | 'demo' | 'offline';
  label: string;
  model: string;
  version: string;
};
type ReviewPayload = ReviewResult & { error?: string; detail?: string; requestId?: string };

interface WorkspaceDraft {
  projectTitle?: string;
  taskType?: WorkspaceTask;
  sourceText?: string;
  supportingContext?: string;
  responseLocation?: string;
  targetJournal?: string;
  sectionType?: ReviewSection;
  reviewMode?: ReviewMode;
  lockedTerms?: TerminologyLock[];
  savedAt?: string;
}

interface ReviewSnapshot {
  id: string;
  projectTitle: string;
  taskType: WorkspaceTask;
  sourceText: string;
  supportingContext: string;
  responseLocation: string;
  targetJournal: string;
  sectionType: ReviewSection;
  reviewMode: ReviewMode;
  lockedTerms: TerminologyLock[];
  requestId: string;
  result: ReviewResult;
  decisions: IssueDecisions;
  savedAt: string;
}

interface DiffSegment {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    document: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6z" /><path d="m9 12 2 2 4-5" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 21h16" /></>,
    copy: <><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="M12 3 2.8 20h18.4z" /><path d="M12 9v4M12 17h.01" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    save: <><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    translate: <><path d="M4 5h8M8 3v2c0 4-2 7-5 9M5 10c1.3 1.8 3 3.2 5 4" /><path d="m13 20 4-10 4 10M14.5 16h5" /></>,
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

function taskMeta(taskType: WorkspaceTask) {
  return TASK_OPTIONS.find((item) => item.id === taskType) || TASK_OPTIONS[2];
}

function decisionMeta(decision?: ReviewResult['decision']) {
  if (decision === 'ready') return { label: 'Ready for Final Use', zh: '可进入最终核对', tone: 'ready' };
  if (decision === 'minor_revision') return { label: 'Minor Revision', zh: '建议小修', tone: 'minor' };
  if (decision === 'major_revision') return { label: 'Major Revision', zh: '建议大修', tone: 'major' };
  return { label: 'Awaiting Workflow', zh: '等待处理', tone: 'pending' };
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
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'scholarforge-output';
}

function readHistory(): ReviewSnapshot[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ReviewSnapshot => Boolean(
      item && typeof item === 'object'
      && typeof (item as ReviewSnapshot).id === 'string'
      && typeof (item as ReviewSnapshot).sourceText === 'string'
      && Array.isArray((item as ReviewSnapshot).result?.issues),
    )).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function writeHistory(history: ReviewSnapshot[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // A restricted browser may block persistence; the current result remains usable in memory.
  }
}

function tokenize(value: string) {
  return value.match(/\S+|\s+/g) || [];
}

function buildDiff(original: string, revised: string): DiffSegment[] {
  const a = tokenize(original);
  const b = tokenize(revised);
  if (a.length > 700 || b.length > 700) {
    return [
      { kind: 'removed', text: original },
      { kind: 'added', text: revised },
    ];
  }

  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (kind: DiffSegment['kind'], value: string) => {
    const last = segments[segments.length - 1];
    if (last?.kind === kind) last.text += value;
    else segments.push({ kind, text: value });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('removed', a[i]);
      i += 1;
    } else {
      push('added', b[j]);
      j += 1;
    }
  }
  while (i < a.length) push('removed', a[i++]);
  while (j < b.length) push('added', b[j++]);
  return segments;
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

function buildMarkdownReport(
  result: ReviewResult,
  source: string,
  context: string,
  requestId: string,
  decisions: IssueDecisions,
) {
  const traces = result.agentRuns
    .map((run) => `- ${AGENT_LABELS[run.agent]}: ${run.status}, ${formatDuration(run.durationMs)}, ${run.issueCount} issues, model=${run.model}`)
    .join('\n');
  const terms = result.terminology.length
    ? result.terminology
      .map((term) => `- **${term.preferred}** — ${term.note}${term.avoid.length ? `; avoid: ${term.avoid.join(', ')}` : ''}`)
      .join('\n')
    : '- No terminology rules generated.';
  const guards = result.guardrails
    .map((item) => `- ${item.passed ? '[x]' : '[ ]'} ${item.label}`)
    .join('\n');

  return `# ScholarForge OS / PaperLens Workflow Report\n\n`
    + `- Project: ${result.profile.projectTitle}\n`
    + `- Task: ${result.profile.taskType}\n`
    + `- Target journal: ${result.profile.targetJournal || 'Not specified'}\n`
    + `- Section: ${result.profile.sectionType}\n`
    + `- Review mode: ${result.profile.reviewMode}\n`
    + `- Request ID: ${requestId || 'Not available'}\n`
    + `- Workflow: ${result.workflowVersion} (${result.executionMode})\n`
    + `- Score: ${result.scoreBefore} → ${result.scoreAfter}\n\n`
    + `## Executive summary\n\n${result.summary}\n\n`
    + `## Decision rationale\n\n${result.decisionReason}\n\n`
    + `## Scientific guardrails\n\n${guards}\n\n`
    + `## Author decision log\n\n${buildDecisionLog(result, decisions)}\n\n`
    + `## Agent execution trace\n\n${traces}\n\n`
    + `## Terminology profile\n\n${terms}\n\n`
    + `## Primary input\n\n${source}\n\n`
    + `${context ? `## Author-supplied context\n\n${context}\n\n` : ''}`
    + `## Primary output\n\n${result.revisedText}\n`;
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function SummaryColumn({
  result,
  decisions,
  onDownload,
}: {
  result: ReviewResult | null;
  decisions: IssueDecisions;
  onDownload: (kind: 'output' | 'report' | 'json' | 'decisions') => void;
}) {
  const meta = decisionMeta(result?.decision);
  const score = result?.scoreAfter ?? 0;
  const counts = {
    accepted: Object.values(decisions).filter((value) => value === 'accepted').length,
    deferred: Object.values(decisions).filter((value) => value === 'deferred').length,
    dismissed: Object.values(decisions).filter((value) => value === 'dismissed').length,
    pending: result
      ? result.issues.filter((issue) => (decisions[issue.id] || 'pending') === 'pending').length
      : 0,
  };
  const passedGuards = result?.guardrails.filter((item) => item.passed).length ?? 0;

  return (
    <div className="sf-summary-stack">
      <section className={`sf-summary-card sf-readiness tone-${meta.tone}`}>
        <div className="sf-kicker">Workflow readiness</div>
        <div className="sf-readiness-head">
          <div>
            <span className="sf-decision-zh">{meta.zh}</span>
            <h2>{meta.label}</h2>
            <p>{result ? `${result.scoreBefore} → ${result.scoreAfter}` : '完成任务后生成判断'}</p>
          </div>
          <div className="sf-score-ring" style={{ '--score-angle': `${score * 3.6}deg` } as CSSProperties}>
            <div><strong>{result ? score : '—'}</strong><span>/ 100</span></div>
          </div>
        </div>
        <div className="sf-decision-summary">
          {result ? result.summary : '模型负责专业判断，代码负责保护规则、评分与最终状态。'}
        </div>
        {result ? <p className="sf-decision-reason">{result.decisionReason}</p> : null}
      </section>

      <section className="sf-summary-card">
        <div className="sf-card-head">
          <div><div className="sf-kicker">Evidence & decisions</div><h3>证据处理进度</h3></div>
          <span>{result?.issues.length ?? 0}</span>
        </div>
        <div className="sf-decision-metrics">
          <div className="is-accepted"><span>已接受</span><strong>{counts.accepted}</strong></div>
          <div className="is-deferred"><span>暂缓</span><strong>{counts.deferred}</strong></div>
          <div className="is-dismissed"><span>忽略</span><strong>{counts.dismissed}</strong></div>
          <div><span>待处理</span><strong>{counts.pending}</strong></div>
        </div>
        <div className="pl-guard-summary">
          <span>保护规则</span>
          <strong>{passedGuards}/{result?.guardrails.length ?? 4}</strong>
        </div>
      </section>

      <section className="sf-summary-card">
        <div className="sf-kicker">Deliverables</div>
        <h3>任务交付物</h3>
        <p className="sf-card-copy">导出主输出、证据报告、作者决策和结构化 JSON。</p>
        <div className="sf-deliverables">
          <button disabled={!result} onClick={() => onDownload('output')} type="button">
            <i>TXT</i><span><b>Primary Output</b><small>{result ? taskMeta(result.profile.taskType).outputLabel : '主输出'}</small></span><Icon name="download" size={17} />
          </button>
          <button disabled={!result} onClick={() => onDownload('report')} type="button">
            <i>MD</i><span><b>Evidence Report</b><small>完整工作流报告</small></span><Icon name="download" size={17} />
          </button>
          <button disabled={!result} onClick={() => onDownload('decisions')} type="button">
            <i>LOG</i><span><b>Decision Log</b><small>作者决策日志</small></span><Icon name="download" size={17} />
          </button>
          <button disabled={!result} onClick={() => onDownload('json')} type="button">
            <i>JSON</i><span><b>Structured Evidence</b><small>可复用结构化数据</small></span><Icon name="download" size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}

export function PaperLensWorkspace() {
  const [projectTitle, setProjectTitle] = useState('NMR research writing task');
  const [taskType, setTaskType] = useState<WorkspaceTask>('precheck');
  const [text, setText] = useState(SAMPLE_MANUSCRIPT);
  const [supportingContext, setSupportingContext] = useState('');
  const [responseLocation, setResponseLocation] = useState('');
  const [targetJournal, setTargetJournal] = useState('Construction and Building Materials');
  const [sectionType, setSectionType] = useState<ReviewSection>('methods');
  const [reviewMode, setReviewMode] = useState<ReviewMode>('balanced');
  const [lockedTerms, setLockedTerms] = useState<TerminologyLock[]>([
    {
      id: 'default-lfnmr',
      source: '低场核磁共振',
      preferred: 'low-field nuclear magnetic resonance (LF-NMR)',
      note: '首次出现使用全称和缩写。',
    },
  ]);
  const [lockSource, setLockSource] = useState('');
  const [lockPreferred, setLockPreferred] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [requestId, setRequestId] = useState('');
  const [activeSnapshotId, setActiveSnapshotId] = useState('');
  const [decisions, setDecisions] = useState<IssueDecisions>({});
  const [activeTab, setActiveTab] = useState<ResultTab>('output');
  const [outputView, setOutputView] = useState<OutputView>('split');
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
  const [health, setHealth] = useState<HealthState>({
    state: 'checking',
    label: '正在检查百炼配置',
    model: 'qwen-plus',
    version: APP_VERSION,
  });

  const currentTask = taskMeta(taskType);
  const minimumLength = taskType === 'review-response' ? 20 : 40;
  const inputValid = text.trim().length >= minimumLength && text.length <= 12_000;
  const saveLabel = draftSavedAt
    ? `草稿已保存 · ${new Date(draftSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    : '草稿将在本机自动保存';

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as WorkspaceDraft;
        if (typeof draft.projectTitle === 'string') setProjectTitle(draft.projectTitle);
        if (draft.taskType) setTaskType(draft.taskType);
        if (typeof draft.sourceText === 'string') setText(draft.sourceText);
        if (typeof draft.supportingContext === 'string') setSupportingContext(draft.supportingContext);
        if (typeof draft.responseLocation === 'string') setResponseLocation(draft.responseLocation);
        if (typeof draft.targetJournal === 'string') setTargetJournal(draft.targetJournal);
        if (draft.sectionType) setSectionType(draft.sectionType);
        if (draft.reviewMode) setReviewMode(draft.reviewMode);
        if (Array.isArray(draft.lockedTerms)) setLockedTerms(draft.lockedTerms);
        if (draft.savedAt) setDraftSavedAt(draft.savedAt);
      }
    } catch {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Restricted storage should not block the current in-memory workspace.
      }
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
          projectTitle,
          taskType,
          sourceText: text,
          supportingContext,
          responseLocation,
          targetJournal,
          sectionType,
          reviewMode,
          lockedTerms,
          savedAt,
        }));
        setDraftSavedAt(savedAt);
      } catch {
        // Keep the current workspace usable even when browser persistence is unavailable.
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftReady, lockedTerms, projectTitle, responseLocation, reviewMode, sectionType, supportingContext, targetJournal, taskType, text]);

  useEffect(() => {
    let alive = true;
    fetch('/api/health', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Health check failed');
        return response.json() as Promise<{
          version?: string;
          model?: string;
          modelStudioConfigured?: boolean;
        }>;
      })
      .then((payload) => {
        if (!alive) return;
        const configured = Boolean(payload.modelStudioConfigured);
        setHealth({
          state: configured ? 'configured' : 'demo',
          label: configured ? '百炼服务端已配置' : '安全演示模式',
          model: payload.model || 'qwen-plus',
          version: payload.version || APP_VERSION,
        });
      })
      .catch(() => {
        if (!alive) return;
        setHealth({
          state: 'offline',
          label: '服务状态暂不可用',
          model: 'qwen-plus',
          version: APP_VERSION,
        });
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 120);
    return () => window.clearInterval(timer);
  }, [loading]);

  const actionItems = useMemo(
    () => result?.issues.filter((issue) => (
      issue.severity === 'major'
      || issue.agent === 'method'
      || issue.agent === 'logic'
      || issue.revised.includes('[Please provide')
    )) ?? [],
    [result],
  );

  const filteredIssues = useMemo(() => {
    const priority: Record<ReviewIssue['severity'], number> = { major: 0, minor: 1, suggestion: 2 };
    const query = issueQuery.trim().toLowerCase();
    return (result?.issues ?? [])
      .filter((issue) => severityFilter === 'all' || issue.severity === severityFilter)
      .filter((issue) => agentFilter === 'all' || issue.agent === agentFilter)
      .filter((issue) => decisionFilter === 'all' || (decisions[issue.id] || 'pending') === decisionFilter)
      .filter((issue) => !query || [
        issue.category,
        issue.location,
        issue.reason,
        issue.original,
        issue.revised,
      ].join(' ').toLowerCase().includes(query))
      .slice()
      .sort((a, b) => priority[a.severity] - priority[b.severity]);
  }, [agentFilter, decisionFilter, decisions, issueQuery, result, severityFilter]);

  const diffSegments = useMemo(
    () => result ? buildDiff(text, result.revisedText) : [],
    [result, text],
  );

  async function handleWorkflow() {
    if (loading || !inputValid) return;
    setLoading(true);
    setElapsedMs(0);
    setError('');
    setResult(null);
    setRequestId('');
    setActiveSnapshotId('');
    setDecisions({});
    setActiveTab('output');
    setMobileView('review');
    setExpandedIssueIds([]);

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle,
          taskType,
          text,
          supportingContext,
          responseLocation,
          targetJournal,
          sectionType,
          reviewMode,
          lockedTerms,
        }),
      });
      const payload = await response.json() as ReviewPayload;
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Workflow request failed.');
      if (!Array.isArray(payload.issues) || !Array.isArray(payload.agentRuns)) {
        throw new Error('工作流返回的数据结构不完整，请稍后重试。');
      }

      const nextDecisions = Object.fromEntries(
        payload.issues.map((issue) => [issue.id, 'pending']),
      ) as IssueDecisions;
      const nextRequestId = payload.requestId || '';
      const snapshotId = crypto.randomUUID();

      setResult(payload);
      setRequestId(nextRequestId);
      setActiveSnapshotId(snapshotId);
      setDecisions(nextDecisions);

      const snapshot: ReviewSnapshot = {
        id: snapshotId,
        projectTitle: projectTitle.trim() || 'Untitled research writing task',
        taskType,
        sourceText: text,
        supportingContext,
        responseLocation,
        targetJournal,
        sectionType,
        reviewMode,
        lockedTerms,
        requestId: nextRequestId,
        result: payload,
        decisions: nextDecisions,
        savedAt: new Date().toISOString(),
      };
      writeHistory([snapshot, ...readHistory()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '任务失败，请检查配置后重试。');
      setMobileView('compose');
    } finally {
      setLoading(false);
    }
  }

  function switchTask(nextTask: WorkspaceTask) {
    setTaskType(nextTask);
    setResult(null);
    setRequestId('');
    setActiveSnapshotId('');
    setDecisions({});
    setActiveTab('output');
    setOutputView('split');
    setSupportingContext('');
    setResponseLocation('');
  }

  function restoreSample() {
    if (taskType === 'translate') {
      setProjectTitle('Chinese-to-English NMR paragraph');
      setText(SAMPLE_CHINESE_MANUSCRIPT);
      setSectionType('methods');
      setSupportingContext('');
      setResponseLocation('');
    } else if (taskType === 'review-response') {
      setProjectTitle('Reviewer 2 response drafting');
      setText(SAMPLE_REVIEW_COMMENT);
      setSupportingContext(SAMPLE_RESPONSE_CONTEXT);
      setResponseLocation('Methods section; final page and line numbers pending');
      setSectionType('methods');
    } else {
      setProjectTitle(taskType === 'polish' ? 'NMR English polishing' : 'NMR pre-submission review');
      setText(SAMPLE_MANUSCRIPT);
      setSupportingContext('');
      setResponseLocation('');
      setSectionType('methods');
    }
    setTargetJournal('Construction and Building Materials');
    setReviewMode('balanced');
    setResult(null);
    setRequestId('');
    setActiveSnapshotId('');
    setDecisions({});
    setMobileView('compose');
  }

  function clearTask() {
    if (!window.confirm('清空当前任务的文本、配置和结果？本机历史快照不会被删除。')) return;
    setProjectTitle('');
    setText('');
    setSupportingContext('');
    setResponseLocation('');
    setTargetJournal('');
    setSectionType('general');
    setReviewMode('balanced');
    setLockedTerms([]);
    setResult(null);
    setRequestId('');
    setActiveSnapshotId('');
    setDecisions({});
    setActiveTab('output');
    setMobileView('compose');
    setError('');
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Restricted storage should not block clearing the in-memory task.
    }
    setDraftSavedAt('');
  }

  function addTerminologyLock() {
    const source = lockSource.trim();
    const preferred = lockPreferred.trim();
    if (!source || !preferred || lockedTerms.length >= 12) return;
    setLockedTerms((current) => [...current, { id: crypto.randomUUID(), source, preferred }]);
    setLockSource('');
    setLockPreferred('');
  }

  function updateIssueDecision(issueId: string, value: IssueDecision) {
    setDecisions((current) => {
      const next = { ...current, [issueId]: value };
      if (result) {
        const history = readHistory();
        const updated = history.map((item) => {
          const matches = activeSnapshotId
            ? item.id === activeSnapshotId
            : item.result.generatedAt === result.generatedAt;
          return matches ? { ...item, decisions: next } : item;
        });
        writeHistory(updated);
      }
      return next;
    });
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1_500);
    } catch {
      setError('浏览器没有授予剪贴板权限，请手动选择并复制文本。');
    }
  }

  function toggleIssue(id: string) {
    setExpandedIssueIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  }

  function toggleAllIssues() {
    const ids = filteredIssues.map((issue) => issue.id);
    const allExpanded = ids.length > 0 && ids.every((id) => expandedIssueIds.includes(id));
    setExpandedIssueIds((current) => (
      allExpanded
        ? current.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current, ...ids]))
    ));
  }

  function downloadArtifact(kind: 'output' | 'report' | 'json' | 'decisions') {
    if (!result) return;
    const stem = safeFileStem(projectTitle || targetJournal);
    const task = taskMeta(result.profile.taskType);
    if (kind === 'output') {
      downloadText(`${stem}-${result.outputKind}.txt`, result.revisedText, 'text/plain;charset=utf-8');
      return;
    }
    if (kind === 'report') {
      downloadText(
        `${stem}-evidence-report.md`,
        buildMarkdownReport(result, text, supportingContext, requestId, decisions),
        'text/markdown;charset=utf-8',
      );
      return;
    }
    if (kind === 'decisions') {
      downloadText(
        `${stem}-author-decisions.md`,
        `# ${task.label} · Author Decision Log\n\n${buildDecisionLog(result, decisions)}\n`,
        'text/markdown;charset=utf-8',
      );
      return;
    }
    downloadText(
      `${stem}-workflow-result.json`,
      JSON.stringify({
        projectTitle,
        taskType,
        sourceText: text,
        supportingContext,
        responseLocation,
        requestId,
        decisions,
        ...result,
      }, null, 2),
      'application/json;charset=utf-8',
    );
  }

  const resultTabs: Array<{ id: ResultTab; label: string; count?: number }> = [
    { id: 'output', label: '主输出' },
    { id: 'actions', label: '作者待办', count: actionItems.length },
    { id: 'issues', label: '问题决策', count: result?.issues.length ?? 0 },
    { id: 'facts', label: '事实保护', count: result?.guardrails.filter((item) => !item.passed).length ?? 0 },
    { id: 'terms', label: '术语库', count: result?.terminology.length ?? 0 },
    { id: 'trace', label: '运行轨迹', count: result?.agentRuns.length ?? 0 },
  ];

  return (
    <main className="sf-shell pl-shell">
      <header className="sf-topbar">
        <div className="sf-topbar-inner">
          <a className="sf-brand" href="#sf-workspace" aria-label="ScholarForge OS 工作台">
            <span className="sf-brand-mark">S</span>
            <span>
              <strong>ScholarForge OS <i>｜研语工坊</i></strong>
              <small>PaperLens scientific writing workflows</small>
            </span>
          </a>
          <nav className="sf-desktop-nav" aria-label="主要导航">
            <a href="#sf-workspace">科研写作台</a>
            <a href="https://github.com/liqinglq666/scholarforge-os/blob/main/docs/PRD.md" rel="noreferrer" target="_blank">产品路线</a>
            <a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">
              <Icon name="github" size={16} />GitHub
            </a>
          </nav>
          <div className="sf-topbar-actions">
            <div className={`sf-service-status is-${health.state}`}><span />{health.label}</div>
            <span className="sf-version">v{health.version}</span>
          </div>
        </div>
      </header>

      <nav className="sf-mobile-nav" aria-label="移动端工作区导航">
        <button aria-current={mobileView === 'compose'} onClick={() => setMobileView('compose')} type="button">
          <Icon name="document" size={18} />输入
        </button>
        <button aria-current={mobileView === 'review'} onClick={() => setMobileView('review')} type="button">
          <Icon name="spark" size={18} />输出
        </button>
        <button aria-current={mobileView === 'issues'} onClick={() => { setMobileView('issues'); setActiveTab('issues'); }} type="button">
          <Icon name="alert" size={18} />问题<i>{result?.issues.length ?? 0}</i>
        </button>
        <button aria-current={mobileView === 'export'} onClick={() => setMobileView('export')} type="button">
          <Icon name="download" size={18} />导出
        </button>
      </nav>

      <div className="sf-workspace" id="sf-workspace">
        <aside className="sf-left-rail">
          <section className="sf-rail-card sf-project-card">
            <div className="sf-kicker">Current workflow</div>
            <h2>{projectTitle || '未命名科研写作任务'}</h2>
            <p>翻译、润色、预检和返修信共用同一条科学保护与证据链。</p>
            <div className="sf-project-ticket">
              <span>{currentTask.eyebrow}</span>
              <strong>{currentTask.label}</strong>
              <small>
                {SECTION_OPTIONS.find((item) => item.id === sectionType)?.label}
                {' · '}
                {MODE_OPTIONS.find((item) => item.id === reviewMode)?.label}
              </small>
            </div>
            <div className="sf-draft-state"><Icon name="save" size={15} /><span>{saveLabel}</span></div>
          </section>

          <section className="sf-rail-card">
            <div className="sf-rail-head">
              <div><div className="sf-kicker">Agent team</div><h3>并行专家组</h3></div>
              <span>4</span>
            </div>
            <div className="sf-agent-list" aria-live="polite">
              {AGENTS.map((agent) => {
                const run = result?.agentRuns.find((item) => item.agent === agent.id);
                const done = run?.status === 'completed' || run?.status === 'demo';
                return (
                  <div className={`sf-agent-row ${done ? 'is-done' : ''} ${loading ? 'is-running' : ''} ${run?.status === 'failed' ? 'is-failed' : ''}`} key={agent.id}>
                    <span className="sf-agent-avatar">{done ? <Icon name="check" size={15} /> : agent.short}</span>
                    <span className="sf-agent-copy"><b>{agent.name}</b><small>{agent.role}</small></span>
                    <span className="sf-agent-state">{done && run ? formatDuration(run.durationMs) : loading ? '运行中' : '等待'}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="sf-main-column">
          <div className={`sf-mobile-section ${mobileView === 'compose' ? 'is-mobile-active' : ''}`}>
            <section className="sf-hero pl-hero">
              <div className="sf-hero-copy">
                <div className="sf-hero-eyebrow"><span />PaperLens research writing agent</div>
                <h1>把科研英语工具，变成<em>一套可切换的专业工作流。</em></h1>
                <p>从中文科研原文到英文投稿稿件，再到预检和返修信；所有任务共享术语锁、事实保护、问题证据与作者决策。</p>
              </div>
              <div className="sf-assurance">
                <Icon name="shield" size={22} />
                <span><b>Scientific facts protected</b><small>事实、数值与术语锁保护开启</small></span>
              </div>
              <ol className="sf-steps">
                <li className="is-current"><span>01</span><div><b>选择工作流</b><small>翻译、润色、预检或回复</small></div></li>
                <li className={loading ? 'is-current' : result ? 'is-complete' : ''}><span>02</span><div><b>并行处理</b><small>4 个百炼 Agent</small></div></li>
                <li className={result ? 'is-current' : ''}><span>03</span><div><b>核对交付</b><small>差异、事实与作者决策</small></div></li>
              </ol>
            </section>

            <section className="sf-composer pl-composer">
              <div className="sf-section-head">
                <div><span>01</span><div><div className="sf-kicker">Workflow setup</div><h2>选择科研英语任务</h2></div></div>
                <div className={inputValid ? 'sf-length is-valid' : 'sf-length is-invalid'}>
                  <b>{text.length.toLocaleString()} / 12,000</b>
                  <small>{inputValid ? `${wordCount(text)} words · 可以开始` : `至少输入 ${minimumLength} 个字符`}</small>
                </div>
              </div>

              <div className="pl-task-grid">
                {TASK_OPTIONS.map((task) => (
                  <button className={taskType === task.id ? 'is-active' : ''} key={task.id} onClick={() => switchTask(task.id)} type="button">
                    <span>
                      {task.id === 'translate'
                        ? <Icon name="translate" size={20} />
                        : task.id === 'review-response'
                          ? <Icon name="copy" size={20} />
                          : task.id === 'precheck'
                            ? <Icon name="shield" size={20} />
                            : <Icon name="spark" size={20} />}
                    </span>
                    <b>{task.label}</b>
                    <small>{task.description}</small>
                  </button>
                ))}
              </div>

              <div className="sf-profile-grid">
                <div className="sf-field">
                  <label htmlFor="pl-project-title">项目名称</label>
                  <div className="sf-input-shell"><Icon name="document" size={18} /><input id="pl-project-title" onChange={(event) => setProjectTitle(event.target.value)} placeholder="例如：Underwater ECC manuscript" value={projectTitle} /></div>
                </div>
                <div className="sf-field">
                  <label htmlFor="pl-journal">目标期刊 <span>可选</span></label>
                  <div className="sf-input-shell"><Icon name="document" size={18} /><input id="pl-journal" onChange={(event) => setTargetJournal(event.target.value)} placeholder="例如：Construction and Building Materials" value={targetJournal} /></div>
                </div>
              </div>

              <div className="sf-profile-grid sf-profile-grid-selects">
                <label className="sf-select-field">
                  论文章节
                  <select onChange={(event) => setSectionType(event.target.value as ReviewSection)} value={sectionType}>
                    {SECTION_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.hint}</option>)}
                  </select>
                </label>
                <label className="sf-select-field">
                  处理强度
                  <select onChange={(event) => setReviewMode(event.target.value as ReviewMode)} value={reviewMode}>
                    {MODE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.hint}</option>)}
                  </select>
                </label>
              </div>

              <div className="sf-field">
                <label htmlFor="pl-primary-input">{currentTask.inputLabel}</label>
                <textarea id="pl-primary-input" onChange={(event) => setText(event.target.value)} placeholder={currentTask.placeholder} spellCheck={false} value={text} />
                <div className="sf-text-meta">
                  <span><Icon name="save" size={14} />{saveLabel}</span>
                  <span><Icon name="shield" size={14} />模型仅在服务端调用</span>
                </div>
              </div>

              {taskType === 'review-response' ? (
                <div className="pl-response-fields">
                  <div className="sf-field">
                    <label htmlFor="pl-support-context">作者依据与拟修改内容 <span>必须由作者提供真实信息</span></label>
                    <textarea id="pl-support-context" onChange={(event) => setSupportingContext(event.target.value)} placeholder="填写已经完成的实验、真实数据、解释依据和拟修改句子；不要让 AI 猜测……" value={supportingContext} />
                  </div>
                  <div className="sf-field">
                    <label htmlFor="pl-response-location">修改位置 <span>可选</span></label>
                    <div className="sf-input-shell"><Icon name="document" size={18} /><input id="pl-response-location" onChange={(event) => setResponseLocation(event.target.value)} placeholder="例如：Methods, Page 8, Lines 211–218" value={responseLocation} /></div>
                  </div>
                </div>
              ) : null}

              <section className="pl-term-locker">
                <div className="pl-term-locker-head">
                  <div><div className="sf-kicker">Terminology lock</div><h3>锁定专业术语</h3><p>适合材料名称、试件编号、缩写和团队统一表达；锁定内容会发送给四个 Agent。</p></div>
                  <span>{lockedTerms.length}/12</span>
                </div>
                <div className="pl-lock-form">
                  <input onChange={(event) => setLockSource(event.target.value)} placeholder={taskType === 'translate' ? '中文术语，例如：应变硬化水泥基复合材料' : '原文或禁用表达'} value={lockSource} />
                  <input onChange={(event) => setLockPreferred(event.target.value)} placeholder="必须采用的英文表达" value={lockPreferred} />
                  <button disabled={!lockSource.trim() || !lockPreferred.trim() || lockedTerms.length >= 12} onClick={addTerminologyLock} type="button"><Icon name="lock" size={16} />添加术语锁</button>
                </div>
                {lockedTerms.length ? (
                  <div className="pl-lock-list">
                    {lockedTerms.map((lock) => (
                      <article key={lock.id}>
                        <span><Icon name="lock" size={14} /></span>
                        <div><b>{lock.preferred}</b><small>{lock.source}</small></div>
                        <button aria-label="删除术语锁" onClick={() => setLockedTerms((current) => current.filter((item) => item.id !== lock.id))} type="button"><Icon name="trash" size={15} /></button>
                      </article>
                    ))}
                  </div>
                ) : <div className="pl-lock-empty">尚未锁定术语。没有明确规范时，Terminology Guardian 会生成建议术语库。</div>}
              </section>

              <div className="sf-review-profile-note">
                <Icon name="spark" size={17} />
                <div>
                  <b>{currentTask.label} · {SECTION_OPTIONS.find((item) => item.id === sectionType)?.label} · {MODE_OPTIONS.find((item) => item.id === reviewMode)?.label}</b>
                  <span>{currentTask.description}</span>
                </div>
              </div>

              <div className="sf-composer-actions">
                <div>
                  <button className="sf-ghost-button" onClick={restoreSample} type="button"><Icon name="refresh" size={16} />载入该模式示例</button>
                  <button className="sf-ghost-button danger" onClick={clearTask} type="button"><Icon name="trash" size={16} />清空当前任务</button>
                </div>
                <button className="sf-primary-button" disabled={loading || !inputValid} onClick={handleWorkflow} type="button">
                  {loading
                    ? <><span className="sf-spinner" />4 个 Agent 正在并行处理</>
                    : <><Icon name="spark" size={18} />{currentTask.cta}<Icon name="chevron" size={17} /></>}
                </button>
              </div>

              <div aria-live="assertive">
                {error ? (
                  <div className="sf-error">
                    <Icon name="alert" size={18} />
                    <div><b>任务未完成</b><span>{error}</span></div>
                    <button onClick={handleWorkflow} type="button">重试</button>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className={`sf-mobile-section ${mobileView === 'review' || mobileView === 'issues' ? 'is-mobile-active' : ''}`}>
            {(loading || result) ? (
              <section className={`sf-workflow-status ${loading ? 'is-loading' : 'is-complete'}`} aria-live="polite">
                <div className="sf-workflow-head">
                  <span className="sf-workflow-icon">{loading ? <span className="sf-spinner" /> : <Icon name="check" size={18} />}</span>
                  <div>
                    <b>{loading ? '四个专业 Agent 已同时发出请求' : `${taskMeta(result?.profile.taskType || taskType).label}工作流已完成`}</b>
                    <small>{loading ? `已等待 ${(elapsedMs / 1_000).toFixed(1)} 秒` : `${result?.profile.sectionType} · ${result?.profile.reviewMode} · Workflow ${result?.workflowVersion}${requestId ? ` · ${requestId}` : ''}`}</small>
                  </div>
                  <span><Icon name="clock" size={16} />{loading ? `${(elapsedMs / 1_000).toFixed(1)} s` : '完成'}</span>
                </div>
                <div className="sf-workflow-track"><i /></div>
              </section>
            ) : null}

            {result ? (
              <section className="sf-results">
                <div className="sf-results-head">
                  <div><span>02</span><div><div className="sf-kicker">PaperLens evidence</div><h2>{taskMeta(result.profile.taskType).outputLabel}与证据</h2></div></div>
                  <div className="sf-results-actions">
                    <span className={`sf-live-mode ${result.mode === 'live' ? 'is-live' : 'is-demo'}`}><i />{result.mode === 'live' ? `百炼真实多 Agent · ${health.model}` : '安全演示模式'}</span>
                    <button onClick={handleWorkflow} type="button"><Icon name="refresh" size={15} />重新运行</button>
                  </div>
                </div>

                <div className="sf-tabs" role="tablist">
                  {resultTabs.map((tab) => (
                    <button aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'is-active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">
                      {tab.label}{tab.count !== undefined ? <span>{tab.count}</span> : null}
                    </button>
                  ))}
                </div>

                <div className="sf-result-body">
                  {activeTab === 'output' ? (
                    <div className="sf-comparison pl-output-view">
                      <div className="sf-comparison-toolbar">
                        <div><span>{wordCount(text)} → {wordCount(result.revisedText)} words</span><span>{taskMeta(result.profile.taskType).label}</span><span>{result.profile.lockedTerms.length} 条术语锁</span></div>
                        <div className="pl-view-switch">
                          <button className={outputView === 'split' ? 'is-active' : ''} onClick={() => setOutputView('split')} type="button">双栏</button>
                          <button className={outputView === 'clean' ? 'is-active' : ''} onClick={() => setOutputView('clean')} type="button">清洁稿</button>
                          <button className={outputView === 'diff' ? 'is-active' : ''} onClick={() => setOutputView('diff')} type="button">变更高亮</button>
                          <button onClick={() => copyText(result.revisedText, 'output')} type="button"><Icon name="copy" size={16} />{copied === 'output' ? '已复制' : '复制输出'}</button>
                        </div>
                      </div>

                      {outputView === 'split' ? (
                        <div className="sf-paper-grid">
                          <article className="sf-paper">
                            <header><div><span>Primary input</span><b>{taskMeta(result.profile.taskType).inputLabel}</b></div><small>{wordCount(text)} words</small></header>
                            <p>{text}</p>
                            {supportingContext ? <aside><b>作者依据</b><p>{supportingContext}</p></aside> : null}
                          </article>
                          <article className="sf-paper is-revised">
                            <header><div><span>PaperLens output</span><b>{taskMeta(result.profile.taskType).outputLabel}</b></div><small>{wordCount(result.revisedText)} words</small></header>
                            <p>{result.revisedText}</p>
                          </article>
                        </div>
                      ) : null}

                      {outputView === 'clean' ? (
                        <article className="sf-paper is-revised pl-clean-paper">
                          <header><div><span>Clean output</span><b>{taskMeta(result.profile.taskType).outputLabel}</b></div><button onClick={() => copyText(result.revisedText, 'clean')} type="button"><Icon name="copy" size={15} />{copied === 'clean' ? '已复制' : '复制'}</button></header>
                          <p>{result.revisedText}</p>
                        </article>
                      ) : null}

                      {outputView === 'diff' ? (
                        <article className="pl-diff-paper">
                          <header><div><b>变更高亮</b><span><i className="is-added" />新增或替换 <i className="is-removed" />删除</span></div><small>长文本会采用整体区块高亮，避免浏览器卡顿。</small></header>
                          <p>{diffSegments.map((segment, index) => <span className={`is-${segment.kind}`} key={`${segment.kind}-${index}`}>{segment.text}</span>)}</p>
                        </article>
                      ) : null}
                    </div>
                  ) : null}

                  {activeTab === 'actions' ? (
                    <div className="sf-actions-view">
                      <div className="sf-action-intro">
                        <div><div className="sf-kicker">Author action list</div><h3>这些问题仍需要作者确认</h3><p>逻辑、方法、重大问题和所有占位符不会因为语言变流畅而自动消失。</p></div>
                        <button onClick={() => copyText(buildDecisionLog(result, decisions), 'actions')} type="button"><Icon name="copy" size={16} />{copied === 'actions' ? '已复制' : '复制待办清单'}</button>
                      </div>
                      {actionItems.length ? (
                        <div className="sf-action-list">
                          {actionItems.map((issue, index) => (
                            <article key={issue.id}>
                              <span>{String(index + 1).padStart(2, '0')}</span>
                              <div>
                                <div><i>{AGENT_LABELS[issue.agent]}</i><i>{severityChinese(issue.severity)}</i><i>{DECISION_LABELS[decisions[issue.id] || 'pending']}</i></div>
                                <h4>{issue.category}</h4>
                                <p>{issue.reason}</p>
                                <small>{issue.revised || '请作者补充、核对或重新表述。'}</small>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : <div className="sf-empty"><Icon name="check" size={25} /><b>没有额外作者待办</b></div>}
                    </div>
                  ) : null}

                  {activeTab === 'issues' ? (
                    <div className="sf-issues-view">
                      <div className="sf-filter-bar">
                        <div className="sf-search-shell"><Icon name="search" size={16} /><input onChange={(event) => setIssueQuery(event.target.value)} placeholder="搜索问题、位置或理由" value={issueQuery} /></div>
                        <label>严重程度<select onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} value={severityFilter}><option value="all">全部</option><option value="major">Major</option><option value="minor">Minor</option><option value="suggestion">Suggestion</option></select></label>
                        <label>来源 Agent<select onChange={(event) => setAgentFilter(event.target.value as AgentFilter)} value={agentFilter}><option value="all">全部</option>{AGENTS.map((agent) => <option key={agent.id} value={agent.id}>{AGENT_LABELS[agent.id]}</option>)}</select></label>
                        <label>作者决策<select onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)} value={decisionFilter}><option value="all">全部</option><option value="pending">待处理</option><option value="accepted">已接受</option><option value="deferred">暂缓</option><option value="dismissed">忽略</option></select></label>
                        <button onClick={toggleAllIssues} type="button">全部展开/收起</button>
                      </div>

                      <div className="sf-issue-list">
                        {filteredIssues.map((issue, index) => {
                          const expanded = expandedIssueIds.includes(issue.id);
                          const issueDecision = decisions[issue.id] || 'pending';
                          return (
                            <article className={`sf-issue-card severity-${issue.severity} decision-${issueDecision} ${expanded ? 'is-expanded' : ''}`} key={issue.id}>
                              <button aria-expanded={expanded} className="sf-issue-summary" onClick={() => toggleIssue(issue.id)} type="button">
                                <span className="sf-issue-number">{String(index + 1).padStart(2, '0')}</span>
                                <span className="sf-issue-main">
                                  <span><i>{AGENT_LABELS[issue.agent]}</i><i>{severityChinese(issue.severity)}</i><i className={`sf-decision-chip is-${issueDecision}`}>{DECISION_LABELS[issueDecision]}</i></span>
                                  <b>{issue.category}</b>
                                  <small>{issue.reason}</small>
                                </span>
                                <span className="sf-issue-expand"><Icon name="chevron" size={18} /></span>
                              </button>
                              {expanded ? (
                                <div className="sf-issue-detail">
                                  <div className="sf-change-grid">
                                    <div><span>Original / Evidence</span><p>{issue.original || 'No original excerpt supplied.'}</p></div>
                                    <div><span>Suggested revision / Action</span><p>{issue.revised || 'Author action required.'}</p></div>
                                  </div>
                                  <div className="sf-decision-actions">
                                    <span>作者决策</span>
                                    {(['accepted', 'deferred', 'dismissed', 'pending'] as IssueDecision[]).map((value) => (
                                      <button className={issueDecision === value ? 'is-active' : ''} key={value} onClick={() => updateIssueDecision(issue.id, value)} type="button">{DECISION_LABELS[value]}</button>
                                    ))}
                                  </div>
                                  <div className={issue.meaningChanged ? 'sf-meaning is-warning' : 'sf-meaning'}>
                                    <Icon name={issue.meaningChanged ? 'alert' : 'shield'} size={16} />
                                    {issue.meaningChanged ? '该建议可能影响科学含义，请作者重点核对。' : '该建议未被 Agent 标记为科学含义变化。'}
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                        {!filteredIssues.length ? <div className="sf-empty"><Icon name="search" size={25} /><b>没有匹配的问题</b></div> : null}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'facts' ? (
                    <div className="pl-fact-view">
                      <div className="sf-action-intro"><div><div className="sf-kicker">Scientific fact protection</div><h3>事实、数值与术语锁检查</h3><p>这些规则是确定性安全检查，不等同于文献事实核验或正式同行评议。</p></div></div>
                      <div className="pl-fact-grid">
                        {(result.guardrails.length ? result.guardrails : DEFAULT_GUARDRAILS).map((guardrail) => (
                          <article className={guardrail.passed ? 'is-passed' : 'is-warning'} key={guardrail.id}>
                            <span>{guardrail.passed ? <Icon name="check" size={20} /> : <Icon name="alert" size={20} />}</span>
                            <div><b>{guardrail.passed ? '检查通过' : '需要人工核对'}</b><p>{guardrail.label}</p></div>
                          </article>
                        ))}
                      </div>
                      <section className="pl-lock-audit">
                        <div><div className="sf-kicker">Locked terminology audit</div><h4>术语锁执行情况</h4></div>
                        {result.profile.lockedTerms.length ? (
                          <div>
                            {result.profile.lockedTerms.map((lock) => {
                              const sourceBundle = `${text}\n${supportingContext}`.toLowerCase();
                              const triggered = sourceBundle.includes(lock.source.toLowerCase());
                              const preserved = !triggered || result.revisedText.toLowerCase().includes(lock.preferred.toLowerCase());
                              return (
                                <article className={preserved ? 'is-passed' : 'is-warning'} key={lock.id}>
                                  <span>{preserved ? '✓' : '!'}</span>
                                  <div><b>{lock.preferred}</b><small>{triggered ? `触发词：${lock.source}` : `本次输入未出现：${lock.source}`}</small></div>
                                </article>
                              );
                            })}
                          </div>
                        ) : <p>本次任务没有用户自定义术语锁。</p>}
                      </section>
                    </div>
                  ) : null}

                  {activeTab === 'terms' ? (
                    <div className="sf-term-grid">
                      {result.terminology.length ? result.terminology.map((term, index) => (
                        <article className="sf-term-card" key={`${term.preferred}-${index}`}>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <h3>{term.preferred}</h3>
                          {term.avoid.length ? <div><b>避免混用</b>{term.avoid.join(' · ')}</div> : null}
                          <p>{term.note}</p>
                        </article>
                      )) : <div className="sf-empty"><Icon name="check" size={25} /><b>本次未生成额外术语规则</b></div>}
                    </div>
                  ) : null}

                  {activeTab === 'trace' ? (
                    <div className="sf-trace-grid">
                      {result.agentRuns.map((run) => (
                        <article className={`sf-trace-card status-${run.status}`} key={run.agent}>
                          <header>
                            <span>{AGENTS.find((agent) => agent.id === run.agent)?.short}</span>
                            <div><b>{AGENT_LABELS[run.agent]}</b><small>{run.model}</small></div>
                            <i>{run.status}</i>
                          </header>
                          <p>{run.summary}</p>
                          <div><span><Icon name="clock" size={15} />耗时 <b>{formatDuration(run.durationMs)}</b></span><span><Icon name="alert" size={15} />问题 <b>{run.issueCount}</b></span></div>
                          {run.error ? <small>{run.error}</small> : null}
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : !loading ? (
              <section className="sf-empty-workspace">
                <div><span>译</span><span>润</span><span>审</span><span>回</span><i><Icon name="spark" size={24} /></i></div>
                <section><div className="sf-kicker">PaperLens workflow workspace</div><h2>一个入口，覆盖科研英语的四个关键阶段</h2><p>先选择任务，再由四个百炼 Agent 生成主输出、问题证据、事实保护结果、术语规则和作者决策日志。</p></section>
              </section>
            ) : null}
          </div>

          <div className={`sf-mobile-summary sf-mobile-section ${mobileView === 'export' ? 'is-mobile-active' : ''}`}>
            <SummaryColumn decisions={decisions} onDownload={downloadArtifact} result={result} />
          </div>
        </section>

        <aside className="sf-right-rail">
          <SummaryColumn decisions={decisions} onDownload={downloadArtifact} result={result} />
        </aside>
      </div>

      <footer className="sf-footer">
        <span>ScholarForge OS · PaperLens research writing workflows</span>
        <span>Powered by Alibaba Cloud Model Studio · {health.model}</span>
      </footer>
    </main>
  );
}
