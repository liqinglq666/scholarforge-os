'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import {
  AGENT_LABELS,
  APP_VERSION,
  DECISION_LABELS,
  SECTION_LABELS,
  WORKFLOW_DESCRIPTIONS,
  WORKFLOW_LABELS,
  WORKSPACE_TEXT_LIMIT,
} from '@/lib/app-config';
import { analyseIssueAnchor, composeWorkingText, createAppliedEdit, type AppliedEdit } from '@/lib/author-editing';
import { createEvidenceItems, evidenceRisk } from '@/lib/evidence-model';
import { exportAuthorDocx } from '@/lib/docx-export';
import type { ReviewSnapshot, WorkspaceDraft } from '@/lib/workspace-schema';
import type {
  IssueDecision,
  ReviewIssue,
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

type CanvasView = 'original' | 'suggested' | 'working';
type MobilePanel = 'structure' | 'manuscript' | 'evidence';
type ReviewPayload = ReviewResult & { error?: string; detail?: string; requestId?: string };

const SECTION_OPTIONS = Object.entries(SECTION_LABELS) as Array<[ReviewSection, string]>;
const WORKFLOW_OPTIONS = Object.entries(WORKFLOW_LABELS) as Array<[WorkspaceTask, string]>;


function safeFileStem(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'scholarforge-output';
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

function buildReport(result: ReviewResult, source: string, decisions: Record<string, IssueDecision>) {
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
    + `- Version: ${APP_VERSION}\n- Project: ${result.profile.projectTitle}\n- Workflow: ${WORKFLOW_LABELS[result.profile.taskType]}\n- Section: ${SECTION_LABELS[result.profile.sectionType]}\n\n`
    + `## Summary\n\n${result.summary}\n\n## Evidence and author decisions\n\n${issues}\n\n## Source\n\n${source}\n\n## Suggested output\n\n${result.revisedText}\n`;
}

function riskLabel(issue: ReviewIssue) {
  const risk = evidenceRisk(issue);
  return risk === 'high' ? '高风险' : risk === 'medium' ? '需核对' : '低风险';
}

export function EvidenceWorkbench({ initialDraft, initialSnapshot, onBack, onImport, onDraftSaved, onSnapshotChanged }: EvidenceWorkbenchProps) {
  const [projectTitle, setProjectTitle] = useState(initialSnapshot?.projectTitle || initialDraft.projectTitle || '未命名科研写作任务');
  const [taskType, setTaskType] = useState<WorkspaceTask>(initialSnapshot?.taskType || initialDraft.taskType || 'precheck');
  const [sourceText, setSourceText] = useState(initialSnapshot?.sourceText || initialDraft.sourceText || '');
  const [targetJournal, setTargetJournal] = useState(initialSnapshot?.targetJournal || initialDraft.targetJournal || '');
  const [sectionType, setSectionType] = useState<ReviewSection>(initialSnapshot?.sectionType || initialDraft.sectionType || 'general');
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

  const minimum = 40;
  const inputValid = sourceText.trim().length >= minimum && sourceText.length <= WORKSPACE_TEXT_LIMIT;
  const workingText = useMemo(() => composeWorkingText(sourceText, appliedEdits), [appliedEdits, sourceText]);
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
        targetJournal,
        sectionType,
        lockedTerms,
        savedAt,
      };
      onDraftSaved(draft);
      setSaveTime(savedAt);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [initialDraft.importedDocument, lockedTerms, onDraftSaved, projectTitle, sectionType, sourceText, targetJournal, taskType]);

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
      targetJournal,
      sectionType,
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
        body: JSON.stringify({ projectTitle, taskType, text: sourceText, targetJournal, sectionType, lockedTerms }),
      });
      const payload = await response.json() as ReviewPayload;
      if (!response.ok) throw new Error(payload.detail || payload.error || '工作流请求失败。');
      if (!Array.isArray(payload.issues) || typeof payload.revisedText !== 'string') throw new Error('工作流返回的数据结构不完整。');
      const nextId = crypto.randomUUID();
      const nextDecisions = Object.fromEntries(payload.issues.map((issue) => [issue.id, 'pending'])) as Record<string, IssueDecision>;
      const nextRequestId = payload.requestId || '';
      const snapshot: ReviewSnapshot = {
        id: nextId,
        projectTitle: projectTitle.trim() || '未命名科研写作任务',
        taskType,
        sourceText,
        targetJournal,
        sectionType,
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

  function exportArtifact(kind: 'text' | 'report' | 'docx') {
    if (!result) return;
    const stem = safeFileStem(projectTitle);
    if (kind === 'text') downloadText(`${stem}-suggested-output.txt`, result.revisedText, 'text/plain;charset=utf-8');
    if (kind === 'report') downloadText(`${stem}-evidence-report.md`, buildReport(result, sourceText, decisions), 'text/markdown;charset=utf-8');
    if (kind === 'docx') {
      void exportAuthorDocx({
        projectTitle,
        targetJournal,
        sectionLabel: SECTION_LABELS[sectionType],
        sourceText,
        edits: appliedEdits,
      }).catch(() => setError('DOCX 导出失败，当前项目状态已保留。'));
    }
  }

  const canvasText = canvasView === 'original' ? sourceText : canvasView === 'suggested' ? result?.revisedText || sourceText : workingText;
  const selectedAnalysis = selectedItem ? analyseIssueAnchor(sourceText, selectedItem.issue, appliedEdits) : null;
  const decidedCount = evidenceItems.length - pendingCount;
  const selectedAnchorReady = selectedAnalysis?.state === 'applied' || selectedAnalysis?.state.startsWith('safe');

  return (
    <main className={`sf-studio ${result ? 'is-reviewing' : 'is-composing'}`}>
      <header className="sf-studio-header">
        <div className="sf-studio-identity">
          <button aria-label="返回首页" className="sf-icon-button is-quiet" onClick={onBack} type="button"><Icon name="arrow-left" /></button>
          <div>
            <input aria-label="项目名称" maxLength={120} onChange={(event) => setProjectTitle(event.target.value)} value={projectTitle} />
            <span>{result ? `${decidedCount}/${evidenceItems.length} 条已处理` : sourceText.trim() ? '内容已准备' : '新建任务'}</span>
          </div>
        </div>

        <div className="sf-save-indicator" aria-live="polite">
          <span />
          {saveTime ? `已自动保存 ${new Date(saveTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '等待保存'}
        </div>

        <div className="sf-studio-actions">
          {result ? <>
            <button aria-label="撤销" className="sf-icon-button is-quiet" disabled={!undoStack.length} onClick={undo} type="button"><Icon name="undo" /></button>
            <button aria-label="重做" className="sf-icon-button is-quiet" disabled={!redoStack.length} onClick={redo} type="button"><Icon name="redo" /></button>
          </> : null}

          <details className="sf-action-menu">
            <summary aria-label="更多操作"><Icon name="more" /></summary>
            <div>
              <button onClick={onImport} type="button"><Icon name="import" />重新导入文档</button>
              {result ? <button disabled={!inputValid || loading} onClick={() => void runWorkflow()} type="button"><Icon name="spark" />重新分析当前文本</button> : null}
            </div>
          </details>

          {result ? (
            <details className="sf-export-menu">
              <summary className="sf-button is-primary"><Icon name="download" />导出</summary>
              <div>
                <button onClick={() => exportArtifact('docx')} type="button"><span>作者工作稿</span><small>DOCX</small></button>
                <hr />
                <button onClick={() => exportArtifact('text')} type="button"><span>建议文本</span><small>TXT</small></button>
                <button onClick={() => exportArtifact('report')} type="button"><span>证据报告</span><small>MD</small></button>
              </div>
            </details>
          ) : null}
        </div>
      </header>

      {error ? <div className="sf-studio-notice is-danger" role="alert"><Icon name="warning" />{error}<button onClick={() => setError('')} type="button"><Icon name="close" size={15} /></button></div> : null}
      {notice ? <div className="sf-studio-notice" aria-live="polite"><Icon name="check" />{notice}<button onClick={() => setNotice('')} type="button"><Icon name="close" size={15} /></button></div> : null}

      {!result ? (
        <div className="sf-compose-layout">
          <section className="sf-compose-document">
            <header>
              <div>
                <span className="sf-section-label">01 · 文稿内容</span>
                <h1>{initialDraft.importedDocument?.sectionTitle || '粘贴或编辑要处理的文本'}</h1>
              </div>
              <span className={sourceText.length > WORKSPACE_TEXT_LIMIT ? 'is-over' : ''}>{sourceText.length.toLocaleString()} / {WORKSPACE_TEXT_LIMIT.toLocaleString()}</span>
            </header>

            {initialDraft.importedDocument ? (
              <div className="sf-imported-source"><Icon name="file" size={15} /><span>{initialDraft.importedDocument.fileName}</span><small>{initialDraft.importedDocument.sourceLabel}</small></div>
            ) : null}

            <textarea
              aria-label="科研文本"
              maxLength={WORKSPACE_TEXT_LIMIT}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder={taskType === 'translate' ? '粘贴需要翻译的中文科研内容……' : '粘贴英文论文段落，或使用右上角菜单导入 DOCX……'}
              value={sourceText}
            />

            <footer>
              <span><Icon name="shield" size={15} /> 分析不会直接覆盖你的原文</span>
              {!inputValid ? <b>{sourceText.trim().length < minimum ? `还需至少 ${Math.max(0, minimum - sourceText.trim().length)} 个字符` : '文本超过当前处理上限'}</b> : <b className="is-ready"><Icon name="check" size={14} /> 可以开始分析</b>}
            </footer>
          </section>

          <aside className="sf-compose-settings">
            <div className="sf-compose-heading">
              <span className="sf-section-label">02 · 处理目标</span>
              <h2>这次希望完成什么？</h2>
              <p>选择最接近的目标即可。其他设置已有安全默认值。</p>
            </div>

            <div className="sf-goal-list">
              {WORKFLOW_OPTIONS.map(([key, label]) => (
                <button aria-pressed={taskType === key} className={taskType === key ? 'is-selected' : ''} key={key} onClick={() => { setTaskType(key); setResult(null); setSnapshotId(''); setDecisions({}); setAppliedEdits([]); }} type="button">
                  <span>{taskType === key ? <Icon name="check" size={15} /> : null}</span>
                  <div><b>{label}</b><small>{WORKFLOW_DESCRIPTIONS[key]}</small></div>
                </button>
              ))}
            </div>


            <details className="sf-advanced-settings">
              <summary>章节与术语设置 <Icon name="chevron-down" size={16} /></summary>
              <div>
                <label><span>论文章节</span><select onChange={(event) => setSectionType(event.target.value as ReviewSection)} value={sectionType}>{SECTION_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label><span>目标期刊（可选）</span><input maxLength={160} onChange={(event) => setTargetJournal(event.target.value)} placeholder="例如 Construction and Building Materials" value={targetJournal} /></label>

                <div className="sf-term-settings">
                  <header><span>术语锁</span><small>{lockedTerms.length}/12</small></header>
                  {lockedTerms.length ? <div className="sf-term-chips">{lockedTerms.map((lock) => <span key={lock.id}><b>{lock.source}</b> → {lock.preferred}<button aria-label="删除术语锁" onClick={() => setLockedTerms((current) => current.filter((item) => item.id !== lock.id))} type="button"><Icon name="close" size={12} /></button></span>)}</div> : <p>锁定必须保持一致的专业术语或缩写。</p>}
                  <div className="sf-term-add"><input onChange={(event) => setLockSource(event.target.value)} placeholder="原词" value={lockSource} /><input onChange={(event) => setLockPreferred(event.target.value)} placeholder="规范表达" value={lockPreferred} /><button aria-label="添加术语锁" disabled={!lockSource.trim() || !lockPreferred.trim()} onClick={addLock} type="button"><Icon name="plus" size={16} /></button></div>
                </div>
              </div>
            </details>

            <button className="sf-compose-run" disabled={!inputValid || loading} onClick={() => void runWorkflow()} type="button">
              <span>{loading ? <span className="sf-spinner" /> : <Icon name="spark" size={20} />}</span>
              <div><b>{loading ? '正在生成可核对建议' : '开始分析'}</b><small>{loading ? formatDuration(elapsedMs) : `${WORKFLOW_LABELS[taskType]} · ${SECTION_LABELS[sectionType]}`}</small></div>
              {!loading ? <Icon name="arrow-right" /> : null}
            </button>
          </aside>
        </div>
      ) : (
        <>
          <nav className="sf-review-mobile-nav" aria-label="审阅页面">
            <button aria-current={mobilePanel === 'structure'} onClick={() => setMobilePanel('structure')} type="button"><Icon name="menu" />问题{pendingCount ? <i>{pendingCount}</i> : null}</button>
            <button aria-current={mobilePanel === 'manuscript'} onClick={() => setMobilePanel('manuscript')} type="button"><Icon name="document" />文稿</button>
            <button aria-current={mobilePanel === 'evidence'} onClick={() => setMobilePanel('evidence')} type="button"><Icon name="shield" />建议</button>
          </nav>

          <div className="sf-review-layout">
            <aside className={`sf-review-queue ${mobilePanel === 'structure' ? 'is-mobile-active' : ''}`}>
              <header className="sf-queue-header">
                <div><span className="sf-section-label">审阅问题</span><h2>{pendingCount ? `${pendingCount} 条需要处理` : '全部处理完成'}</h2></div>
                <div className="sf-review-progress" aria-label={`已处理 ${decidedCount} 条，共 ${evidenceItems.length} 条`}><span style={{ width: evidenceItems.length ? `${(decidedCount / evidenceItems.length) * 100}%` : '0%' }} /></div>
              </header>

              <div className="sf-queue-tools">
                <label><Icon name="search" size={15} /><input onChange={(event) => setIssueQuery(event.target.value)} placeholder="搜索问题" value={issueQuery} /></label>
                <select aria-label="按严重程度筛选" onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)} value={severityFilter}>
                  <option value="all">全部</option><option value="major">重大</option><option value="minor">一般</option><option value="suggestion">建议</option>
                </select>
              </div>

              <div className="sf-queue-list">
                {filteredItems.map((item, index) => (
                  <button className={selectedItem?.issue.id === item.issue.id ? 'is-selected' : ''} key={item.issue.id} onClick={() => { setSelectedIssueId(item.issue.id); setMobilePanel('evidence'); }} type="button">
                    <span className={`sf-severity-marker is-${item.risk}`} />
                    <div><b>{item.issue.category}</b><small>{item.issue.location || AGENT_LABELS[item.issue.agent]}</small></div>
                    <span className={`sf-decision-state is-${item.decision}`}>{item.applied ? '已应用' : item.decisionLabel}</span>
                    <i>{String(index + 1).padStart(2, '0')}</i>
                  </button>
                ))}
              </div>

              <p className="sf-queue-note">所有建议均需逐条确认后才能应用。</p>
            </aside>

            <section className={`sf-review-document ${mobilePanel === 'manuscript' ? 'is-mobile-active' : ''}`}>
              <header className="sf-document-toolbar">
                <div>
                  <span className="sf-section-label">文稿</span>
                  <p>{WORKFLOW_LABELS[taskType]} · {SECTION_LABELS[sectionType]} · {evidenceItems.length} 条建议</p>
                </div>
                <div className="sf-document-tabs" role="tablist" aria-label="文稿视图">
                  {(['working', 'original', 'suggested'] as CanvasView[]).map((view) => <button aria-selected={canvasView === view} key={view} onClick={() => setCanvasView(view)} role="tab" type="button">{{ working: '工作稿', original: '原文', suggested: '建议稿' }[view]}</button>)}
                </div>
              </header>

              <div className="sf-reading-area">
                <article className="sf-document-text">{canvasText || '暂无文本'}</article>
              </div>

              <footer className="sf-document-footer"><Icon name="shield" size={15} /><span>{canvasView === 'working' ? `工作稿已应用 ${appliedEdits.length} 条修改，可撤销或导出。` : '切换到工作稿查看作者已确认并安全应用的内容。'}</span></footer>
            </section>

            <aside className={`sf-review-inspector ${mobilePanel === 'evidence' ? 'is-mobile-active' : ''}`}>
              {selectedItem ? <>
                <header className="sf-inspector-header">
                  <div><span className="sf-section-label">建议 {selectedIndex + 1} / {evidenceItems.length}</span><h2>{selectedItem.issue.category}</h2></div>
                  <span className={`sf-risk-badge is-${selectedItem.risk}`}>{riskLabel(selectedItem.issue)}</span>
                </header>

                <div className="sf-inspector-meta">
                  <span>{AGENT_LABELS[selectedItem.issue.agent]}</span>
                  <span>{selectedItem.issue.location || '未指定位置'}</span>
                  <span>{selectedItem.issue.severity === 'major' ? '重大问题' : selectedItem.issue.severity === 'minor' ? '一般问题' : '优化建议'}</span>
                </div>

                {selectedItem.issue.meaningChanged ? <div className="sf-alert is-danger"><Icon name="warning" />该建议可能改变科学含义，请结合原始证据人工判断。</div> : null}

                <section className="sf-inspector-compare">
                  <div><span>原文</span><p>{selectedItem.issue.original || '未提供可定位原文'}</p></div>
                  <div><span>建议</span><p>{selectedItem.issue.revised || '需要作者手动补充'}</p></div>
                </section>

                <section className="sf-inspector-reason">
                  <span>为什么提出这条建议</span>
                  <p>{selectedItem.issue.reason}</p>
                </section>

                <section className={`sf-anchor-check ${selectedAnchorReady ? 'is-safe' : 'is-manual'}`}>
                  <Icon name={selectedAnchorReady ? 'check' : 'warning'} size={16} />
                  <div><b>{selectedAnalysis?.state === 'applied' ? '已经应用' : selectedAnchorReady ? '可以安全定位' : '需要人工处理'}</b><p>{selectedAnalysis?.message}</p></div>
                </section>


                <footer className="sf-inspector-actions">
                  <span>作者决定</span>
                  <div className="sf-decision-buttons">
                    <button aria-pressed={selectedItem.decision === 'accepted'} className="is-accept" onClick={() => setDecision(selectedItem.issue.id, 'accepted')} type="button"><Icon name="check" size={15} />接受</button>
                    <button aria-pressed={selectedItem.decision === 'deferred'} onClick={() => setDecision(selectedItem.issue.id, 'deferred')} type="button"><Icon name="clock" size={15} />稍后</button>
                    <button aria-pressed={selectedItem.decision === 'dismissed'} className="is-dismiss" onClick={() => setDecision(selectedItem.issue.id, 'dismissed')} type="button"><Icon name="close" size={15} />不采用</button>
                  </div>
                  <button className="sf-button is-primary is-full" disabled={selectedItem.decision !== 'accepted' || selectedItem.applied} onClick={() => applyIssue(selectedItem.issue)} type="button">{selectedItem.applied ? '已应用到工作稿' : '应用到工作稿'} <Icon name="arrow-right" /></button>
                  <div className="sf-issue-nav"><button onClick={() => moveIssue(-1)} type="button"><Icon name="arrow-left" size={15} />上一条</button><button onClick={() => moveIssue(1)} type="button">下一条<Icon name="arrow-right" size={15} /></button></div>
                </footer>
              </> : <div className="sf-panel-empty"><span><Icon name="shield" size={26} /></span><h2>没有匹配的问题</h2><p>调整筛选条件，或返回文稿继续查看。</p></div>}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
