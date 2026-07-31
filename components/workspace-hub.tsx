'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { PaperLensWorkspace } from '@/components/paperlens-workspace';
import {
  SAMPLE_CHINESE_MANUSCRIPT,
  SAMPLE_MANUSCRIPT,
  SAMPLE_RESPONSE_CONTEXT,
  SAMPLE_REVIEW_COMMENT,
} from '@/lib/demo-review';
import type {
  IssueDecision,
  ReviewMode,
  ReviewResult,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

const APP_VERSION = '1.3.3';
const DRAFT_KEY = 'scholarforge-os-paperlens-draft-v1';
const HISTORY_KEY = 'scholarforge-os-paperlens-history-v1';
const HUB_VIEW_KEY = 'scholarforge-os-hub-view-v1';
const AUTHOR_EDITING_SESSION_KEY = 'scholarforge-os-author-editing-session-v1';
const BACKUP_FORMAT = 'scholarforge-workspace-backup';
const MAX_HISTORY = 8;

type PreviewTab = 'output' | 'issues' | 'trace';

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
  decisions: Record<string, IssueDecision>;
  savedAt: string;
}

interface WorkspaceBackup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  draft: WorkspaceDraft | null;
  history: ReviewSnapshot[];
}

interface WorkflowTemplate {
  id: WorkspaceTask;
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  sectionType: ReviewSection;
  reviewMode: ReviewMode;
  blankTitle: string;
  sampleTitle: string;
  sampleText: string;
  sampleContext?: string;
  sampleLocation?: string;
  targetJournal?: string;
  lockedTerms?: TerminologyLock[];
  accent: string;
}

const WORKFLOW_LABELS: Record<WorkspaceTask, string> = {
  translate: '科研中译英',
  polish: '英文保守润色',
  precheck: '投稿前预检',
  'review-response': '审稿回复助手',
};

const SECTION_LABELS: Record<ReviewSection, string> = {
  general: '通用段落',
  abstract: '摘要',
  introduction: '引言',
  methods: '方法',
  results: '结果',
  discussion: '讨论',
  conclusion: '结论',
};

const DECISION_LABELS: Record<IssueDecision, string> = {
  pending: '待处理',
  accepted: '已接受',
  deferred: '暂缓',
  dismissed: '忽略',
};

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'translate',
    number: '01',
    eyebrow: 'Chinese → Academic English',
    title: '科研中译英',
    description: '将中文科研内容转成保守、清晰、可核对的学术英文，并锁定术语与数值。',
    sectionType: 'abstract',
    reviewMode: 'balanced',
    blankTitle: 'New Chinese-to-English task',
    sampleTitle: 'Chinese-to-English NMR paragraph',
    sampleText: SAMPLE_CHINESE_MANUSCRIPT,
    targetJournal: 'Construction and Building Materials',
    lockedTerms: [{
      id: 'template-lfnmr',
      source: '低场核磁共振',
      preferred: 'low-field nuclear magnetic resonance (LF-NMR)',
      note: '首次出现使用全称和缩写。',
    }],
    accent: 'copper',
  },
  {
    id: 'polish',
    number: '02',
    eyebrow: 'Conservative polishing',
    title: '英文保守润色',
    description: '优化语法、搭配与学术语气，同时保留作者声音、事实和证据强度。',
    sectionType: 'methods',
    reviewMode: 'conservative',
    blankTitle: 'New English polishing task',
    sampleTitle: 'NMR English polishing',
    sampleText: SAMPLE_MANUSCRIPT,
    targetJournal: 'Construction and Building Materials',
    accent: 'green',
  },
  {
    id: 'precheck',
    number: '03',
    eyebrow: 'Reviewer-style precheck',
    title: '投稿前预检',
    description: '用术语、语言、逻辑和方法四条证据链检查稿件的投稿准备度。',
    sectionType: 'methods',
    reviewMode: 'deep',
    blankTitle: 'New pre-submission review',
    sampleTitle: 'NMR pre-submission review',
    sampleText: SAMPLE_MANUSCRIPT,
    targetJournal: 'Construction and Building Materials',
    accent: 'navy',
  },
  {
    id: 'review-response',
    number: '04',
    eyebrow: 'Response to reviewers',
    title: '审稿回复助手',
    description: '基于作者真实依据起草返修信，明确正文修改、位置与尚待补充的信息。',
    sectionType: 'methods',
    reviewMode: 'balanced',
    blankTitle: 'New reviewer response task',
    sampleTitle: 'Reviewer 2 response drafting',
    sampleText: SAMPLE_REVIEW_COMMENT,
    sampleContext: SAMPLE_RESPONSE_CONTEXT,
    sampleLocation: 'Methods section; final page and line numbers pending',
    targetJournal: 'Construction and Building Materials',
    accent: 'plum',
  },
];

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isReviewSnapshot(value: unknown): value is ReviewSnapshot {
  if (!isRecord(value) || !isRecord(value.result)) return false;
  return typeof value.id === 'string'
    && typeof value.projectTitle === 'string'
    && typeof value.sourceText === 'string'
    && typeof value.savedAt === 'string'
    && Array.isArray(value.result.issues)
    && Array.isArray(value.result.agentRuns);
}

function parseBackup(value: unknown): WorkspaceBackup {
  if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.version !== 1 || !Array.isArray(value.history)) {
    throw new Error('这不是受支持的 ScholarForge 工作区备份。');
  }

  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    draft: value.draft === null || isRecord(value.draft) ? value.draft as WorkspaceDraft | null : null,
    history: value.history.filter(isReviewSnapshot).slice(0, MAX_HISTORY),
  };
}

function formatDate(value?: string) {
  if (!value) return '尚未保存';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function humanStorageSize(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_024 / 1_024).toFixed(2)} MB`;
}

function countPending(snapshot: ReviewSnapshot) {
  return snapshot.result.issues.filter((issue) => (snapshot.decisions[issue.id] || 'pending') === 'pending').length;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function draftFromSnapshot(snapshot: ReviewSnapshot): WorkspaceDraft {
  return {
    projectTitle: snapshot.projectTitle,
    taskType: snapshot.taskType,
    sourceText: snapshot.sourceText,
    supportingContext: snapshot.supportingContext,
    responseLocation: snapshot.responseLocation,
    targetJournal: snapshot.targetJournal,
    sectionType: snapshot.sectionType,
    reviewMode: snapshot.reviewMode,
    lockedTerms: snapshot.lockedTerms,
    savedAt: new Date().toISOString(),
  };
}

export function WorkspaceHub() {
  const [view, setView] = useState<'hub' | 'workspace'>('hub');
  const [draft, setDraft] = useState<WorkspaceDraft | null>(null);
  const [history, setHistory] = useState<ReviewSnapshot[]>([]);
  const [query, setQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | WorkspaceTask>('all');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<ReviewSnapshot | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('output');
  const [health, setHealth] = useState({ configured: false, model: 'qwen-plus', version: APP_VERSION });
  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  function refreshLocalState() {
    setDraft(safeParse<WorkspaceDraft | null>(window.localStorage.getItem(DRAFT_KEY), null));
    setHistory(safeParse<ReviewSnapshot[]>(window.localStorage.getItem(HISTORY_KEY), []).filter(isReviewSnapshot).slice(0, MAX_HISTORY));
  }

  useEffect(() => {
    refreshLocalState();
    if (window.sessionStorage.getItem(HUB_VIEW_KEY) === 'workspace') setView('workspace');

    let alive = true;
    fetch('/api/health', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Health check failed');
        return response.json() as Promise<{ model?: string; version?: string; modelStudioConfigured?: boolean }>;
      })
      .then((payload) => {
        if (!alive) return;
        setHealth({
          configured: Boolean(payload.modelStudioConfigured),
          model: payload.model || 'qwen-plus',
          version: payload.version || APP_VERSION,
        });
      })
      .catch(() => undefined);

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && view === 'hub') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.altKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        window.sessionStorage.setItem(HUB_VIEW_KEY, 'hub');
        refreshLocalState();
        setView('hub');
        setPreview(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (event.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view]);

  const filteredHistory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return history.filter((snapshot) => {
      if (taskFilter !== 'all' && snapshot.taskType !== taskFilter) return false;
      if (!normalized) return true;
      return [snapshot.projectTitle, snapshot.targetJournal, WORKFLOW_LABELS[snapshot.taskType], SECTION_LABELS[snapshot.sectionType]]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [history, query, taskFilter]);

  const metrics = useMemo(() => {
    const pending = history.reduce((total, snapshot) => total + countPending(snapshot), 0);
    const scores = history.map((snapshot) => snapshot.result.scoreAfter).filter(Number.isFinite);
    const average = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
    const storageBytes = typeof window === 'undefined' ? 0 : new Blob([
      window.localStorage.getItem(DRAFT_KEY) || '',
      window.localStorage.getItem(HISTORY_KEY) || '',
    ]).size;
    return { total: history.length, pending, average, storage: humanStorageSize(storageBytes) };
  }, [draft, history]);

  function writeDraft(template: WorkflowTemplate, useSample: boolean) {
    const nextDraft: WorkspaceDraft = {
      projectTitle: useSample ? template.sampleTitle : template.blankTitle,
      taskType: template.id,
      sourceText: useSample ? template.sampleText : '',
      supportingContext: useSample ? template.sampleContext || '' : '',
      responseLocation: useSample ? template.sampleLocation || '' : '',
      targetJournal: useSample ? template.targetJournal || '' : '',
      sectionType: template.sectionType,
      reviewMode: template.reviewMode,
      lockedTerms: useSample ? template.lockedTerms || [] : [],
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
    setDraft(nextDraft);
  }

  function openWorkspace(template?: WorkflowTemplate, useSample = false) {
    if (template) writeDraft(template, useSample);
    window.sessionStorage.setItem(HUB_VIEW_KEY, 'workspace');
    setView('workspace');
    setPreview(null);
    window.scrollTo({ top: 0 });
  }

  function returnToHub() {
    window.sessionStorage.setItem(HUB_VIEW_KEY, 'hub');
    refreshLocalState();
    setView('hub');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function continueSnapshot(snapshot: ReviewSnapshot) {
    const nextDraft = draftFromSnapshot(snapshot);
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
    setDraft(nextDraft);
    openWorkspace();
  }

  function showSnapshot(snapshot: ReviewSnapshot) {
    setPreview(snapshot);
    setPreviewTab('output');
  }

  function deleteSnapshot(snapshot: ReviewSnapshot) {
    if (!window.confirm(`确定删除“${snapshot.projectTitle}”的本机审校快照吗？`)) return;
    const next = history.filter((item) => item.id !== snapshot.id);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
    if (preview?.id === snapshot.id) setPreview(null);
    setNotice('本机审校快照已删除。');
  }

  function exportBackup() {
    const payload: WorkspaceBackup = {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      draft: safeParse<WorkspaceDraft | null>(window.localStorage.getItem(DRAFT_KEY), null),
      history: safeParse<ReviewSnapshot[]>(window.localStorage.getItem(HISTORY_KEY), []).filter(isReviewSnapshot).slice(0, MAX_HISTORY),
    };
    downloadJson(`scholarforge-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
    setNotice('本地工作区备份已导出。原始 DOCX、账户和云端项目不包含在此 JSON 中。');
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = parseBackup(JSON.parse(await file.text()) as unknown);
      if (!window.confirm('导入会替换当前浏览器中的草稿和任务历史，是否继续？')) return;
      if (payload.draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload.draft));
      else window.localStorage.removeItem(DRAFT_KEY);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(payload.history));
      window.localStorage.removeItem(AUTHOR_EDITING_SESSION_KEY);
      refreshLocalState();
      setNotice(`已恢复 ${payload.history.length} 条任务记录。原始 DOCX 需要在当前浏览器重新导入。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '备份导入失败。');
    }
  }

  function clearLocalWorkspace() {
    if (!window.confirm('这会删除当前浏览器中的草稿、任务历史和作者修改会话，且无法撤销。是否继续？')) return;
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(HISTORY_KEY);
    window.localStorage.removeItem(AUTHOR_EDITING_SESSION_KEY);
    setDraft(null);
    setHistory([]);
    setPreview(null);
    setNotice('本地草稿、任务历史与作者修改会话已清除。云端项目和原始 DOCX 未被删除。');
  }

  if (view === 'workspace') {
    return <div className="hub-workspace-frame">
      <button className="hub-return-button" onClick={returnToHub} title="快捷键 Alt + H" type="button">
        <span aria-hidden="true">←</span>
        返回项目中心
      </button>
      <PaperLensWorkspace />
    </div>;
  }

  return <main className="hub-shell">
    <header className="hub-topbar">
      <a className="hub-brand" href="#hub-main" aria-label="ScholarForge OS 项目中心">
        <img alt="" src="/icon.svg" />
        <span><strong>ScholarForge OS <i>｜研语工坊</i></strong><small>Research writing project hub</small></span>
      </a>
      <nav aria-label="项目中心导航">
        <a href="#hub-workflows">新建任务</a>
        <a href="#hub-history">任务历史</a>
        <a href="#hub-data">数据与隐私</a>
        <a href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">GitHub ↗</a>
      </nav>
      <div className="hub-status">
        <span className={health.configured ? 'is-live' : 'is-demo'} />
        <b>{health.configured ? '百炼已连接' : '安全演示模式'}</b>
        <i>v{health.version}</i>
      </div>
    </header>

    <section className="hub-main" id="hub-main">
      <section className="hub-hero">
        <div className="hub-hero-copy">
          <span className="hub-eyebrow">Evidence-aware research writing system</span>
          <h1>从一个科研写作任务开始，<em>把每次修改留在证据链里。</em></h1>
          <p>翻译、润色、投稿预检和审稿回复围绕同一论文项目积累术语、问题、作者决策和交付物。</p>
          <div className="hub-hero-actions">
            {draft?.sourceText?.trim()
              ? <button className="hub-primary" onClick={() => openWorkspace()} type="button">继续当前草稿 <span>→</span></button>
              : <button className="hub-primary" onClick={() => openWorkspace(WORKFLOW_TEMPLATES[2], false)} type="button">新建投稿预检 <span>→</span></button>}
            <button className="hub-secondary" onClick={() => openWorkspace(WORKFLOW_TEMPLATES[2], true)} type="button">载入完整演示</button>
          </div>
          <div className="hub-shortcuts"><span><kbd>Ctrl</kbd><kbd>K</kbd> 搜索任务</span><span><kbd>Alt</kbd><kbd>H</kbd> 返回项目中心</span></div>
        </div>
        <aside className="hub-current-card">
          <span>Current workspace</span>
          <h2>{draft?.projectTitle || '还没有正在编辑的任务'}</h2>
          <p>{draft?.taskType ? `${WORKFLOW_LABELS[draft.taskType]} · ${SECTION_LABELS[draft.sectionType || 'general']}` : '选择一个模板，开始建立第一条科研写作证据链。'}</p>
          <div><span>最近保存</span><b>{formatDate(draft?.savedAt)}</b></div>
          <div><span>模型工作流</span><b>4 × {health.model}</b></div>
          <button disabled={!draft} onClick={() => openWorkspace()} type="button">打开当前工作区</button>
        </aside>
      </section>

      <section className="hub-metrics" aria-label="工作区概览">
        <article><span>本机任务快照</span><strong>{metrics.total}</strong><small>项目中心统一管理</small></article>
        <article><span>待处理证据</span><strong>{metrics.pending}</strong><small>尚未接受、暂缓或忽略</small></article>
        <article><span>平均准备度</span><strong>{metrics.average || '—'}</strong><small>{metrics.average ? '/ 100' : '完成任务后统计'}</small></article>
        <article><span>本地数据占用</span><strong>{metrics.storage}</strong><small>草稿与历史，不含原始 DOCX</small></article>
      </section>

      <section className="hub-section" id="hub-workflows">
        <div className="hub-section-head"><div><span>01 · Workflow templates</span><h2>选择科研英语工作流</h2><p>模板只预设章节、处理强度与必要字段，不会替用户虚构任何科研事实。</p></div></div>
        <div className="hub-template-grid">
          {WORKFLOW_TEMPLATES.map((template) => <article className={`hub-template is-${template.accent}`} key={template.id}>
            <header><span>{template.number}</span><i>{template.eyebrow}</i></header>
            <h3>{template.title}</h3>
            <p>{template.description}</p>
            <dl><div><dt>默认章节</dt><dd>{SECTION_LABELS[template.sectionType]}</dd></div><div><dt>处理强度</dt><dd>{template.reviewMode}</dd></div></dl>
            <footer><button onClick={() => openWorkspace(template, false)} type="button">空白任务</button><button onClick={() => openWorkspace(template, true)} type="button">示例演示 →</button></footer>
          </article>)}
        </div>
      </section>

      <section className="hub-section" id="hub-history">
        <div className="hub-section-head hub-history-head">
          <div><span>02 · Review history</span><h2>任务历史与完整结果</h2><p>项目中心是唯一历史入口：查看主输出、问题证据和 Agent 轨迹，或恢复配置继续处理。</p></div>
          <div className="hub-history-tools">
            <label><span aria-hidden="true">⌕</span><input onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、期刊或章节" ref={searchRef} value={query} /></label>
            <select aria-label="按工作流筛选" onChange={(event) => setTaskFilter(event.target.value as 'all' | WorkspaceTask)} value={taskFilter}>
              <option value="all">全部工作流</option>
              {WORKFLOW_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
            </select>
          </div>
        </div>

        {filteredHistory.length ? <div className="hub-history-grid">{filteredHistory.map((snapshot) => {
          const pending = countPending(snapshot);
          return <article key={snapshot.id}>
            <header><span>{WORKFLOW_LABELS[snapshot.taskType]}</span><time>{formatDate(snapshot.savedAt)}</time></header>
            <h3>{snapshot.projectTitle}</h3>
            <p>{snapshot.targetJournal || '未指定目标期刊'}</p>
            <div className="hub-history-stats"><span><b>{snapshot.result.scoreAfter}</b>/100</span><span><b>{snapshot.result.issues.length}</b> 个问题</span><span><b>{pending}</b> 待处理</span></div>
            <footer className="hub-history-actions">
              <span>{SECTION_LABELS[snapshot.sectionType]} · {snapshot.reviewMode}</span>
              <div><button onClick={() => showSnapshot(snapshot)} type="button">查看完整结果</button><button onClick={() => continueSnapshot(snapshot)} type="button">继续配置 →</button></div>
            </footer>
          </article>;
        })}</div> : <div className="hub-empty-history"><span>⌁</span><h3>{history.length ? '没有匹配的任务' : '还没有任务快照'}</h3><p>{history.length ? '调整搜索词或工作流筛选。' : '完成第一次任务后，完整结果会统一保存在这里。'}</p></div>}
      </section>

      <section className="hub-section hub-data-section" id="hub-data">
        <div className="hub-section-head"><div><span>03 · Data control</span><h2>本地数据与隐私控制</h2><p>当前草稿和任务历史默认保存在浏览器中。你可以随时备份、迁移或彻底删除。</p></div></div>
        <div className="hub-data-grid">
          <article><span className="hub-data-icon">↓</span><div><h3>导出工作区备份</h3><p>导出当前草稿、术语锁、任务历史、Agent 结果和作者决策；不包含原始 DOCX。</p></div><button onClick={exportBackup} type="button">导出备份</button></article>
          <article><span className="hub-data-icon">↑</span><div><h3>恢复工作区备份</h3><p>从另一台设备或另一个浏览器恢复本地工作区。导入前会要求确认覆盖。</p></div><button onClick={() => importRef.current?.click()} type="button">选择备份</button><input accept="application/json,.json" hidden onChange={importBackup} ref={importRef} type="file" /></article>
          <article className="is-danger"><span className="hub-data-icon">×</span><div><h3>清除本地工作区</h3><p>删除草稿、任务快照和作者修改会话；账户、云端项目与原始 DOCX 不受影响。</p></div><button onClick={clearLocalWorkspace} type="button">清除数据</button></article>
          <aside><span>Privacy boundary</span><h3>你当前的数据存在哪里？</h3><ul><li>账户身份：Supabase Auth 或本地访客会话</li><li>论文草稿与历史：当前浏览器 localStorage</li><li>原始 DOCX：当前浏览器 IndexedDB</li><li>云端项目：仅在用户主动同步后进入 Supabase，并由 RLS 隔离</li><li>模型处理：提交任务时发送到服务端与阿里云百炼</li></ul></aside>
        </div>
        {notice ? <div className="hub-notice" role="status"><span>✓</span>{notice}<button onClick={() => setNotice('')} type="button">关闭</button></div> : null}
      </section>
    </section>

    <footer className="hub-footer"><span>ScholarForge OS · Research writing project hub</span><span>Powered by Alibaba Cloud Model Studio · {health.model}</span><a href="https://github.com/liqinglq666/scholarforge-os/blob/main/docs/PRD.md" rel="noreferrer" target="_blank">查看产品路线 ↗</a></footer>

    {preview ? <div className="hub-history-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
      <section aria-label="任务历史完整结果" aria-modal="true" className="hub-history-preview" role="dialog">
        <header>
          <div><span>{WORKFLOW_LABELS[preview.taskType]} · {SECTION_LABELS[preview.sectionType]}</span><h2>{preview.projectTitle}</h2><p>{preview.targetJournal || '未指定目标期刊'} · {formatDate(preview.savedAt)}</p></div>
          <button aria-label="关闭历史结果" onClick={() => setPreview(null)} type="button">×</button>
        </header>
        <div className="hub-preview-metrics">
          <span><b>{preview.result.scoreAfter}</b>/100</span>
          <span><b>{preview.result.issues.length}</b> 个问题</span>
          <span><b>{countPending(preview)}</b> 待处理</span>
          <span><b>{preview.result.agentRuns.length}</b> Agent</span>
        </div>
        <nav aria-label="历史结果视图">
          <button aria-selected={previewTab === 'output'} onClick={() => setPreviewTab('output')} type="button">主输出</button>
          <button aria-selected={previewTab === 'issues'} onClick={() => setPreviewTab('issues')} type="button">问题证据</button>
          <button aria-selected={previewTab === 'trace'} onClick={() => setPreviewTab('trace')} type="button">运行轨迹</button>
        </nav>
        <div className="hub-preview-body">
          {previewTab === 'output' ? <div className="hub-preview-output"><section><span>Executive summary</span><p>{preview.result.summary}</p></section><section><span>Primary output</span><p>{preview.result.revisedText}</p></section></div> : null}
          {previewTab === 'issues' ? <div className="hub-preview-issues">{preview.result.issues.map((issue, index) => <article key={issue.id}><header><span>{String(index + 1).padStart(2, '0')}</span><div><b>{issue.category}</b><small>{issue.agent} · {issue.severity} · {DECISION_LABELS[preview.decisions[issue.id] || 'pending']}</small></div></header><p>{issue.reason}</p><div><span>原文</span><p>{issue.original || '未提供原文片段'}</p></div><div><span>建议</span><p>{issue.revised || '需要作者人工处理'}</p></div></article>)}</div> : null}
          {previewTab === 'trace' ? <div className="hub-preview-trace">{preview.result.agentRuns.map((run) => <article key={run.agent}><header><b>{run.agent}</b><span>{run.status}</span></header><p>{run.summary}</p><footer><span>{run.durationMs} ms</span><span>{run.issueCount} 个问题</span><span>{run.model}</span></footer></article>)}</div> : null}
        </div>
        <footer><button className="is-danger" onClick={() => deleteSnapshot(preview)} type="button">删除本机快照</button><div><button onClick={() => setPreview(null)} type="button">关闭</button><button onClick={() => continueSnapshot(preview)} type="button">恢复配置并继续 →</button></div></footer>
      </section>
    </div> : null}
  </main>;
}
