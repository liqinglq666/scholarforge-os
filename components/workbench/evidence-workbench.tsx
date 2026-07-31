'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import {
  AGENT_LABELS,
  APP_VERSION,
  DECISION_LABELS,
  MODE_LABELS,
  SECTION_LABELS,
  WORKFLOW_DESCRIPTIONS,
  WORKFLOW_LABELS,
  WORKSPACE_TEXT_LIMIT,
} from '@/lib/app-config';
import { analyseIssueAnchor, composeWorkingText, createAppliedEdit, type AppliedEdit } from '@/lib/author-editing';
import { canBatchApplyIssue, createEvidenceItems, evidenceRisk } from '@/lib/evidence-model';
import { exportAuthorDocx } from '@/lib/docx-export';
import type { ReviewSnapshot, WorkspaceDraft } from '@/lib/workspace-schema';
import type {
  IssueDecision,
  ReviewIssue,
  ReviewMode,
  ReviewResult,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

interface EvidenceWorkbenchProps {
  initialDraft: WorkspaceDraft;
  initialSnapshot?: ReviewSnapshot | null;
  onBack(): void;
  onImport(): void;
  onDraftSaved(draft: WorkspaceDraft): void;
  onSnapshotChanged(snapshot: ReviewSnapshot): void;
}

type CanvasView = 'original' | 'suggested' | 'working' | 'diff';
type MobilePanel = 'structure' | 'manuscript' | 'evidence';
type ReviewPayload = ReviewResult & { error?: string; detail?: string; requestId?: string };
type DiffSegment = { kind: 'same' | 'added' | 'removed'; text: string };

const SECTION_OPTIONS = Object.entries(SECTION_LABELS) as Array<[ReviewSection, string]>;
const MODE_OPTIONS = Object.entries(MODE_LABELS) as Array<[ReviewMode, string]>;
const WORKFLOW_OPTIONS = Object.entries(WORKFLOW_LABELS) as Array<[WorkspaceTask, string]>;

function taskMinimum(task: WorkspaceTask) {
  return task === 'review-response' ? 20 : 40;
}

function safeFileStem(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'scholarforge-output';
}

function tokenize(value: string) {
  return value.match(/\S+|\s+/g) || [];
}

function buildDiff(original: string, revised: string): DiffSegment[] {
  const a = tokenize(original);
  const b = tokenize(revised);
  if (a.length > 700 || b.length > 700) return [{ kind: 'removed', text: original }, { kind: 'added', text: revised }];
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segments: DiffSegment[] = [];
  const push = (kind: DiffSegment['kind'], text: string) => {
    const last = segments[segments.length - 1];
    if (last?.kind === kind) last.text += text;
    else segments.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push('same', a[i]); i += 1; j += 1; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push('removed', a[i]); i += 1; }
    else { push('added', b[j]); j += 1; }
  }
  while (i < a.length) push('removed', a[i++]);
  while (j < b.length) push('added', b[j++]);
  return segments;
}

function formatDuration(value: number) {
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildReport(result: ReviewResult, source: string, decisions: Record<string, IssueDecision>, requestId: string) {
  const issues = result.issues.map((issue, index) => [
    `### ${index + 1}. ${issue.category}`,
    `- Agent: ${AGENT_LABELS[issue.agent]}`,
    `- Severity: ${issue.severity}`,
    `- Decision: ${DECISION_LABELS[decisions[issue.id] || 'pending']}`,
    `- Location: ${issue.location}`,
    `- Original: ${issue.original || 'Not supplied'}`,
    `- Suggestion: ${issue.revised || 'Author action required'}`,
    `- Reason: ${issue.reason}`,
  ].join('\n')).join('\n\n');
  return `# ScholarForge OS Evidence Report\n\n`
    + `- Version: ${APP_VERSION}\n- Project: ${result.profile.projectTitle}\n- Workflow: ${WORKFLOW_LABELS[result.profile.taskType]}\n- Section: ${SECTION_LABELS[result.profile.sectionType]}\n- Mode: ${MODE_LABELS[result.profile.reviewMode]}\n- Request ID: ${requestId || 'Not available'}\n- Score: ${result.scoreBefore} → ${result.scoreAfter}\n\n`
    + `## Summary\n\n${result.summary}\n\n## Decision rationale\n\n${result.decisionReason}\n\n## Evidence and author decisions\n\n${issues}\n\n## Source\n\n${source}\n\n## Suggested output\n\n${result.revisedText}\n`;
}

function riskLabel(issue: ReviewIssue) {
  const risk = evidenceRisk(issue);
  return risk === 'high' ? '高风险' : risk === 'medium' ? '需核对' : '低风险';
}

export function EvidenceWorkbench({ initialDraft, initialSnapshot, onBack, onImport, onDraftSaved, onSnapshotChanged }: EvidenceWorkbenchProps) {
  const [projectTitle, setProjectTitle] = useState(initialSnapshot?.projectTitle || initialDraft.projectTitle || '未命名科研写作任务');
  const [taskType, setTaskType] = useState<WorkspaceTask>(initialSnapshot?.taskType || initialDraft.taskType || 'precheck');
  const [sourceText, setSourceText] = useState(initialSnapshot?.sourceText || initialDraft.sourceText || '');
  const [supportingContext, setSupportingContext] = useState(initialSnapshot?.supportingContext || initialDraft.supportingContext || '');
  const [responseLocation, setResponseLocation] = useState(initialSnapshot?.responseLocation || initialDraft.responseLocation || '');
  const [targetJournal, setTargetJournal] = useState(initialSnapshot?.targetJournal || initialDraft.targetJournal || '');
  const [sectionType, setSectionType] = useState<ReviewSection>(initialSnapshot?.sectionType || initialDraft.sectionType || 'general');
  const [reviewMode, setReviewMode] = useState<ReviewMode>(initialSnapshot?.reviewMode || initialDraft.reviewMode || 'balanced');
  const [lockedTerms, setLockedTerms] = useState<TerminologyLock[]>(initialSnapshot?.lockedTerms || initialDraft.lockedTerms || []);
  const [lockSource, setLockSource] = useState('');
  const [lockPreferred, setLockPreferred] = useState('');
  const [result, setResult] = useState<ReviewResult | null>(initialSnapshot?.result || null);
  const [requestId, setRequestId] = useState(initialSnapshot?.requestId || '');
  const [snapshotId, setSnapshotId] = useState(initialSnapshot?.id || '');
  const [decisions, setDecisions] = useState<Record<string, IssueDecision>>(initialSnapshot?.decisions || {});
  const [appliedEdits, setAppliedEdits] = useState<AppliedEdit[]>(initialSnapshot?.appliedEdits || []);
  const [undoStack, setUndoStack] = useState<AppliedEdit[][]>([]);
  const [redoStack, setRedoStack] = useState<AppliedEdit[][]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState(initialSnapshot?.result.issues[0]?.id || null);
  const [canvasView, setCanvasView] = useState<CanvasView>(initialSnapshot ? 'suggested' : 'original');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('manuscript');
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saveTime, setSaveTime] = useState(initialDraft.savedAt || initialSnapshot?.savedAt || '');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [issueQuery, setIssueQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | ReviewIssue['severity']>('all');

  const minimum = taskMinimum(taskType);
  const inputValid = sourceText.trim().length >= minimum && sourceText.length <= WORKSPACE_TEXT_LIMIT;
  const workingText = useMemo(() => composeWorkingText(sourceText, appliedEdits), [appliedEdits, sourceText]);
  const diff = useMemo(() => result ? buildDiff(sourceText, result.revisedText) : [], [result, sourceText]);
  const evidenceItems = useMemo(() => result ? createEvidenceItems(result, decisions, appliedEdits) : [], [appliedEdits, decisions, result]);
  const filteredItems = useMemo(() => {
    const query = issueQuery.trim().toLowerCase();
    return evidenceItems.filter((item) => severityFilter === 'all' || item.issue.severity === severityFilter).filter((item) => !query || [item.issue.category, item.issue.location, item.issue.reason, item.issue.original, item.issue.revised].join(' ').toLowerCase().includes(query));
  }, [evidenceItems, issueQuery, severityFilter]);
  const selectedItem = evidenceItems.find((item) => item.issue.id === selectedIssueId) || evidenceItems[0];
  const selectedIndex = selectedItem ? evidenceItems.findIndex((item) => item.issue.id === selectedItem.issue.id) : -1;
  const pendingCount = evidenceItems.filter((item) => item.decision === 'pending' || item.decision === 'deferred').length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const draft: WorkspaceDraft = {
        importedDocument: initialDraft.importedDocument,
        projectTitle,
        taskType,
        sourceText,
        supportingContext,
        responseLocation,
        targetJournal,
        sectionType,
        reviewMode,
        lockedTerms,
        savedAt,
      };
      onDraftSaved(draft);
      setSaveTime(savedAt);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [initialDraft.importedDocument, lockedTerms, onDraftSaved, projectTitle, responseLocation, reviewMode, sectionType, sourceText, supportingContext, targetJournal, taskType]);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
    return () => window.clearInterval(timer);
  }, [loading]);

  function currentSnapshot(nextResult = result, nextDecisions = decisions, nextEdits = appliedEdits): ReviewSnapshot | null {
    if (!nextResult || !snapshotId) return null;
    return {
      id: snapshotId,
      projectTitle: projectTitle.trim() || '未命名科研写作任务',
      taskType,
      sourceText,
      supportingContext,
      responseLocation,
      targetJournal,
      sectionType,
      reviewMode,
      lockedTerms,
      requestId,
      result: nextResult,
      decisions: nextDecisions,
      appliedEdits: nextEdits,
      savedAt: new Date().toISOString(),
    };
  }

  function persistSnapshot(nextResult = result, nextDecisions = decisions, nextEdits = appliedEdits) {
    const snapshot = currentSnapshot(nextResult, nextDecisions, nextEdits);
    if (snapshot) onSnapshotChanged(snapshot);
  }

  async function runWorkflow() {
    if (!inputValid || loading) return;
    setLoading(true);
    setElapsedMs(0);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectTitle, taskType, text: sourceText, supportingContext, responseLocation, targetJournal, sectionType, reviewMode, lockedTerms }),
      });
      const payload = await response.json() as ReviewPayload;
      if (!response.ok) throw new Error(payload.detail || payload.error || '工作流请求失败。');
      if (!Array.isArray(payload.issues) || !Array.isArray(payload.agentRuns)) throw new Error('工作流返回的数据结构不完整。');
      const nextId = crypto.randomUUID();
      const nextDecisions = Object.fromEntries(payload.issues.map((issue) => [issue.id, 'pending'])) as Record<string, IssueDecision>;
      const nextRequestId = payload.requestId || '';
      const snapshot: ReviewSnapshot = {
        id: nextId,
        projectTitle: projectTitle.trim() || '未命名科研写作任务',
        taskType,
        sourceText,
        supportingContext,
        responseLocation,
        targetJournal,
        sectionType,
        reviewMode,
        lockedTerms,
        requestId: nextRequestId,
        result: payload,
        decisions: nextDecisions,
        appliedEdits: [],
        savedAt: new Date().toISOString(),
      };
      setResult(payload);
      setRequestId(nextRequestId);
      setSnapshotId(nextId);
      setDecisions(nextDecisions);
      setAppliedEdits([]);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedIssueId(payload.issues[0]?.id || null);
      setCanvasView('suggested');
      setMobilePanel('evidence');
      onSnapshotChanged(snapshot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '任务失败，请检查服务配置后重试。');
    } finally {
      setLoading(false);
    }
  }

  function setDecision(issueId: string, decision: IssueDecision) {
    const next = { ...decisions, [issueId]: decision };
    setDecisions(next);
    persistSnapshot(result, next, appliedEdits);
  }

  function commitEdits(next: AppliedEdit[]) {
    setUndoStack((stack) => [...stack, appliedEdits].slice(-30));
    setRedoStack([]);
    setAppliedEdits(next);
    persistSnapshot(result, decisions, next);
  }

  function applyIssue(issue: ReviewIssue) {
    if ((decisions[issue.id] || 'pending') !== 'accepted') {
      setNotice('先选择“接受”，再把建议应用到工作稿。');
      return;
    }
    const analysis = analyseIssueAnchor(sourceText, issue, appliedEdits);
    const edit = createAppliedEdit(issue, analysis);
    if (!edit) {
      setNotice(analysis.message);
      return;
    }
    commitEdits([...appliedEdits, edit]);
    setCanvasView('working');
    setNotice('建议已应用到工作稿，可随时撤销。');
  }

  function applyAllEligible() {
    if (!result) return;
    let next = [...appliedEdits];
    let appliedCount = 0;
    for (const item of evidenceItems) {
      if (item.decision !== 'accepted' || !canBatchApplyIssue(sourceText, item.issue, next)) continue;
      const analysis = analyseIssueAnchor(sourceText, item.issue, next);
      const edit = createAppliedEdit(item.issue, analysis);
      if (edit) { next.push(edit); appliedCount += 1; }
    }
    if (!appliedCount) {
      setNotice('没有可批量应用的已接受低风险语言建议。');
      return;
    }
    commitEdits(next);
    setCanvasView('working');
    setNotice(`已应用 ${appliedCount} 条低风险语言建议；高风险内容仍需逐条确认。`);
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, appliedEdits].slice(-30));
    setAppliedEdits(previous);
    persistSnapshot(result, decisions, previous);
  }

  function redo() {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, appliedEdits].slice(-30));
    setAppliedEdits(next);
    persistSnapshot(result, decisions, next);
  }

  function addLock() {
    if (!lockSource.trim() || !lockPreferred.trim() || lockedTerms.length >= 12) return;
    setLockedTerms((current) => [...current, { id: crypto.randomUUID(), source: lockSource.trim(), preferred: lockPreferred.trim() }]);
    setLockSource('');
    setLockPreferred('');
  }

  function moveIssue(offset: number) {
    if (!evidenceItems.length) return;
    const index = selectedIndex < 0 ? 0 : (selectedIndex + offset + evidenceItems.length) % evidenceItems.length;
    setSelectedIssueId(evidenceItems[index].issue.id);
  }

  function exportArtifact(kind: 'text' | 'report' | 'json' | 'clean-docx' | 'tracked-docx') {
    if (!result) return;
    const stem = safeFileStem(projectTitle);
    if (kind === 'text') downloadText(`${stem}-suggested-output.txt`, result.revisedText, 'text/plain;charset=utf-8');
    if (kind === 'report') downloadText(`${stem}-evidence-report.md`, buildReport(result, sourceText, decisions, requestId), 'text/markdown;charset=utf-8');
    if (kind === 'json') downloadText(`${stem}-review-result.json`, JSON.stringify({ sourceText, decisions, appliedEdits, requestId, ...result }, null, 2), 'application/json;charset=utf-8');
    if (kind === 'clean-docx' || kind === 'tracked-docx') {
      void exportAuthorDocx({
        mode: kind === 'clean-docx' ? 'clean' : 'tracked',
        projectTitle,
        targetJournal,
        sectionLabel: SECTION_LABELS[sectionType],
        sourceText,
        edits: appliedEdits,
        issues: result.issues,
        decisions,
      }).catch(() => setError('DOCX 导出失败，当前项目状态已保留。'));
    }
  }

  const canvasText = canvasView === 'original' ? sourceText : canvasView === 'suggested' ? result?.revisedText || sourceText : workingText;

  return (
    <main className="sf-workbench-shell">
      <header className="sf-workbench-bar">
        <div className="sf-workbench-left">
          <button aria-label="返回项目中心" className="sf-icon-button" onClick={onBack} type="button"><Icon name="arrow-left" /></button>
          <div className="sf-project-crumb"><span>研究项目</span><b>{projectTitle || '未命名任务'}</b></div>
        </div>
        <div className="sf-save-state" aria-live="polite"><span /><span>{saveTime ? `已保存 ${new Date(saveTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '等待保存'}</span></div>
        <div className="sf-workbench-actions">
          <button aria-label="撤销" className="sf-icon-button" disabled={!undoStack.length} onClick={undo} type="button"><Icon name="undo" /></button>
          <button aria-label="重做" className="sf-icon-button" disabled={!redoStack.length} onClick={redo} type="button"><Icon name="redo" /></button>
          <button className="sf-button" onClick={onImport} type="button"><Icon name="import" /> 导入</button>
          <details className="sf-menu">
            <summary className="sf-button"><Icon name="download" /> 导出 <Icon name="chevron-down" size={15} /></summary>
            <div>
              <button disabled={!result} onClick={() => exportArtifact('text')} type="button">建议文本 <small>TXT</small></button>
              <button disabled={!result} onClick={() => exportArtifact('report')} type="button">证据报告 <small>MD</small></button>
              <button disabled={!result} onClick={() => exportArtifact('json')} type="button">结构化结果 <small>JSON</small></button>
              <hr />
              <button disabled={!result} onClick={() => exportArtifact('clean-docx')} type="button">作者工作稿 <small>DOCX</small></button>
              <button disabled={!result || !appliedEdits.length} onClick={() => exportArtifact('tracked-docx')} type="button">修订痕迹稿 <small>DOCX</small></button>
            </div>
          </details>
          <button className="sf-button is-primary" disabled={!inputValid || loading} onClick={() => void runWorkflow()} type="button">{loading ? `处理中 ${formatDuration(elapsedMs)}` : result ? '重新运行' : '开始审阅'} <Icon name="spark" /></button>
        </div>
      </header>

      <nav className="sf-mobile-workbench-nav" aria-label="工作台面板">
        <button aria-current={mobilePanel === 'structure'} onClick={() => setMobilePanel('structure')} type="button"><Icon name="menu" />结构</button>
        <button aria-current={mobilePanel === 'manuscript'} onClick={() => setMobilePanel('manuscript')} type="button"><Icon name="document" />正文</button>
        <button aria-current={mobilePanel === 'evidence'} onClick={() => setMobilePanel('evidence')} type="button"><Icon name="shield" />证据{pendingCount ? <i>{pendingCount}</i> : null}</button>
      </nav>

      {error ? <div className="sf-workbench-alert is-danger" role="alert"><Icon name="warning" />{error}<button onClick={() => setError('')} type="button"><Icon name="close" size={15} /></button></div> : null}
      {notice ? <div className="sf-workbench-alert" aria-live="polite"><Icon name="check" />{notice}<button onClick={() => setNotice('')} type="button"><Icon name="close" size={15} /></button></div> : null}

      <div className="sf-workbench-grid">
        <aside className={`sf-structure-panel ${mobilePanel === 'structure' ? 'is-mobile-active' : ''}`}>
          <details className="sf-setup" open={!result}>
            <summary><div><span className="sf-eyebrow">Workflow setup</span><b>任务配置</b></div><Icon name="chevron-down" /></summary>
            <div className="sf-setup-body">
              <label><span>项目名称</span><input maxLength={120} onChange={(event) => setProjectTitle(event.target.value)} value={projectTitle} /></label>
              <label><span>工作流</span><select onChange={(event) => { setTaskType(event.target.value as WorkspaceTask); setResult(null); setSnapshotId(''); setDecisions({}); setAppliedEdits([]); }} value={taskType}>{WORKFLOW_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><small>{WORKFLOW_DESCRIPTIONS[taskType]}</small></label>
              <div className="sf-form-grid is-two">
                <label><span>章节</span><select onChange={(event) => setSectionType(event.target.value as ReviewSection)} value={sectionType}>{SECTION_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label><span>强度</span><select onChange={(event) => setReviewMode(event.target.value as ReviewMode)} value={reviewMode}>{MODE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              </div>
              <label><span>目标期刊</span><input maxLength={160} onChange={(event) => setTargetJournal(event.target.value)} placeholder="可选" value={targetJournal} /></label>
              {taskType === 'review-response' ? <><label><span>作者依据 / 拟修改内容</span><textarea onChange={(event) => setSupportingContext(event.target.value)} rows={4} value={supportingContext} /></label><label><span>修改位置</span><input onChange={(event) => setResponseLocation(event.target.value)} value={responseLocation} /></label></> : null}
              <details className="sf-terms"><summary>术语锁 <span>{lockedTerms.length}/12</span></summary><div>{lockedTerms.map((lock) => <div className="sf-term-row" key={lock.id}><span><b>{lock.source}</b><small>{lock.preferred}</small></span><button aria-label="删除术语锁" onClick={() => setLockedTerms((current) => current.filter((item) => item.id !== lock.id))} type="button"><Icon name="close" size={14} /></button></div>)}<div className="sf-term-form"><input onChange={(event) => setLockSource(event.target.value)} placeholder="原词" value={lockSource} /><input onChange={(event) => setLockPreferred(event.target.value)} placeholder="规范表达" value={lockPreferred} /><button disabled={!lockSource.trim() || !lockPreferred.trim()} onClick={addLock} type="button"><Icon name="plus" size={15} /></button></div></div></details>
            </div>
          </details>

          <section className="sf-outline">
            <header><div><span className="sf-eyebrow">Evidence queue</span><b>审阅问题</b></div><span>{evidenceItems.length}</span></header>
            {result ? <>
              <div className="sf-issue-tools"><label><Icon name="search" size={15} /><input onChange={(event) => setIssueQuery(event.target.value)} placeholder="搜索问题" value={issueQuery} /></label><select aria-label="按严重程度筛选" onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)} value={severityFilter}><option value="all">全部</option><option value="major">重大</option><option value="minor">一般</option><option value="suggestion">建议</option></select></div>
              <div className="sf-issue-list">{filteredItems.map((item, index) => <button className={selectedItem?.issue.id === item.issue.id ? 'is-selected' : ''} key={item.issue.id} onClick={() => { setSelectedIssueId(item.issue.id); setMobilePanel('evidence'); }} type="button"><span className={`sf-risk-dot is-${item.risk}`} /><div><b>{item.issue.category}</b><small>{AGENT_LABELS[item.issue.agent]} · {riskLabel(item.issue)}</small></div><i>{String(index + 1).padStart(2, '0')}</i><em className={`is-${item.decision}`}>{DECISION_LABELS[item.decision]}</em></button>)}</div>
            </> : <div className="sf-panel-empty"><Icon name="shield" size={22} /><p>运行工作流后，结构化问题和作者决策会出现在这里。</p></div>}
          </section>
        </aside>

        <section className={`sf-manuscript-panel ${mobilePanel === 'manuscript' ? 'is-mobile-active' : ''}`}>
          <header className="sf-canvas-header">
            <div><span className="sf-eyebrow">Text review canvas</span><h1>{projectTitle || '未命名任务'}</h1><p>{WORKFLOW_LABELS[taskType]} · {SECTION_LABELS[sectionType]} · {sourceText.length.toLocaleString()} 字符</p></div>
            <div className="sf-view-tabs" role="tablist" aria-label="文稿视图">{(['original', 'suggested', 'working', 'diff'] as CanvasView[]).map((view) => <button aria-selected={canvasView === view} disabled={!result && view !== 'original'} key={view} onClick={() => setCanvasView(view)} role="tab" type="button">{{ original: '原文', suggested: '建议稿', working: '工作稿', diff: '差异' }[view]}</button>)}</div>
          </header>

          <div className="sf-paper-canvas">
            {!result && canvasView === 'original' ? <textarea aria-label="科研文本" maxLength={WORKSPACE_TEXT_LIMIT} onChange={(event) => setSourceText(event.target.value)} placeholder={taskType === 'translate' ? '粘贴中文科研段落……' : taskType === 'review-response' ? '粘贴 Reviewer Comment……' : '粘贴英文论文段落……'} value={sourceText} /> : canvasView === 'diff' ? <div className="sf-diff-text">{diff.map((segment, index) => <span className={`is-${segment.kind}`} key={`${segment.kind}-${index}`}>{segment.text}</span>)}</div> : <div className="sf-document-text">{canvasText || '暂无文本'}</div>}
          </div>

          {!inputValid && !result ? <footer className="sf-canvas-status is-warning"><Icon name="warning" /><span>{sourceText.trim().length < minimum ? `至少输入 ${minimum} 个字符` : `最多支持 ${WORKSPACE_TEXT_LIMIT.toLocaleString()} 个字符`}</span></footer> : <footer className="sf-canvas-status"><Icon name="shield" /><span>建议不会自动写入正文。接受并安全定位后，才可进入工作稿。</span></footer>}
        </section>

        <aside className={`sf-evidence-panel ${mobilePanel === 'evidence' ? 'is-mobile-active' : ''}`}>
          {selectedItem ? <>
            <header className="sf-evidence-header">
              <div><span className="sf-eyebrow">Evidence {String(selectedIndex + 1).padStart(2, '0')} / {String(evidenceItems.length).padStart(2, '0')}</span><h2>{selectedItem.issue.category}</h2></div>
              <span className={`sf-risk-badge is-${selectedItem.risk}`}>{riskLabel(selectedItem.issue)}</span>
            </header>
            <div className="sf-evidence-meta"><span>{AGENT_LABELS[selectedItem.issue.agent]}</span><span>{selectedItem.issue.location || '未指定位置'}</span><span>{selectedItem.issue.severity}</span></div>
            <section className="sf-evidence-reason"><span>判断理由</span><p>{selectedItem.issue.reason}</p>{selectedItem.issue.meaningChanged ? <div className="sf-alert is-danger"><Icon name="warning" />该建议可能改变科学含义，必须人工核对。</div> : null}</section>
            <section className="sf-evidence-compare"><div><span>原文</span><p>{selectedItem.issue.original || '未提供可定位原文'}</p></div><div><span>建议</span><p>{selectedItem.issue.revised || '需要作者手动补充'}</p></div></section>
            <section className="sf-anchor-state"><span>应用检查</span><p>{analyseIssueAnchor(sourceText, selectedItem.issue, appliedEdits).message}</p></section>
            <section className="sf-decision-section"><span>作者决策</span><div>{(['accepted', 'dismissed', 'deferred'] as IssueDecision[]).map((decision) => <button className={selectedItem.decision === decision ? 'is-selected' : ''} key={decision} onClick={() => setDecision(selectedItem.issue.id, decision)} type="button">{DECISION_LABELS[decision]}</button>)}</div><button className="sf-button is-primary is-full" disabled={selectedItem.decision !== 'accepted' || selectedItem.applied} onClick={() => applyIssue(selectedItem.issue)} type="button">{selectedItem.applied ? '已应用到工作稿' : '应用到工作稿'} <Icon name="arrow-right" /></button></section>
            <details className="sf-details sf-agent-details"><summary>Agent 运行信息</summary><div>{result?.agentRuns.map((run) => <p key={run.agent}><b>{AGENT_LABELS[run.agent]}</b><span>{run.status} · {formatDuration(run.durationMs)} · {run.issueCount} issues</span></p>)}</div></details>
          </> : <div className="sf-panel-empty is-large"><span><Icon name="shield" size={28} /></span><h2>证据与作者决策</h2><p>运行任务后，在这里逐条查看理由、风险、原文定位和建议文本。</p></div>}
        </aside>
      </div>

      {result ? <footer className="sf-decision-bar"><div className="sf-decision-nav"><button aria-label="上一条" className="sf-icon-button" onClick={() => moveIssue(-1)} type="button"><Icon name="arrow-left" /></button><span>{selectedIndex + 1} / {evidenceItems.length}</span><button aria-label="下一条" className="sf-icon-button" onClick={() => moveIssue(1)} type="button"><Icon name="arrow-right" /></button></div><div className="sf-decision-progress"><span>作者决策</span><b>{evidenceItems.length - pendingCount} / {evidenceItems.length}</b><i><em style={{ width: evidenceItems.length ? `${((evidenceItems.length - pendingCount) / evidenceItems.length) * 100}%` : '0%' }} /></i></div><button className="sf-button" onClick={applyAllEligible} type="button">批量应用已接受的低风险建议</button><div className="sf-score-chip"><span>准备度</span><b>{result.scoreAfter}</b><small>/100</small></div></footer> : null}
    </main>
  );
}
