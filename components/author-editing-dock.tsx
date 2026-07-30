'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  AUTHOR_EDITING_SESSION_KEY,
  analyseIssueAnchor,
  composeWorkingText,
  createAppliedEdit,
  type AnchorState,
  type AppliedEdit,
} from '@/lib/author-editing';
import { exportAuthorDocx } from '@/lib/docx-export';
import type {
  IssueDecision,
  ReviewIssue,
  ReviewMode,
  ReviewResult,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

const DRAFT_KEY = 'scholarforge-os-paperlens-draft-v1';
const HISTORY_KEY = 'scholarforge-os-paperlens-history-v1';
const HUB_VIEW_KEY = 'scholarforge-os-hub-view-v1';

interface EditingSnapshot {
  id: string;
  projectTitle: string;
  taskType: WorkspaceTask;
  sourceText: string;
  supportingContext?: string;
  responseLocation?: string;
  targetJournal: string;
  sectionType: ReviewSection;
  reviewMode: ReviewMode;
  lockedTerms: TerminologyLock[];
  requestId?: string;
  result: ReviewResult;
  decisions: Record<string, IssueDecision>;
  savedAt: string;
  workingText?: string;
  appliedEdits?: AppliedEdit[];
}

interface SavedEditingSession {
  snapshotId: string;
  sourceText: string;
  applied: AppliedEdit[];
  savedAt: string;
}

const STATUS_LABELS: Record<AnchorState, { label: string; tone: string }> = {
  'safe-exact': { label: '精确定位', tone: 'safe' },
  'safe-whitespace': { label: '空白归一定位', tone: 'safe' },
  applied: { label: '已应用', tone: 'applied' },
  ambiguous: { label: '位置不唯一', tone: 'warning' },
  missing: { label: '原文已变化', tone: 'warning' },
  conflict: { label: '修改冲突', tone: 'danger' },
  manual: { label: '人工处理', tone: 'muted' },
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

function EditIcon({ name }: { name: 'edit' | 'close' | 'undo' | 'redo' | 'check' | 'download' | 'warning' | 'reset' }) {
  const paths: Record<string, ReactNode> = {
    edit: <><path d="M4 20h4l11-11-4-4L4 16z" /><path d="m13.5 6.5 4 4M4 20h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    undo: <><path d="M9 8 4 12l5 4" /><path d="M5 12h8a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 8 5 4-5 4" /><path d="M19 12h-8a6 6 0 0 0-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 21h16" /></>,
    warning: <><path d="M12 3 2.8 20h18.4z" /><path d="M12 9v4M12 17h.01" /></>,
    reset: <><path d="M20 11a8 8 0 1 0-2.4 5.7" /><path d="M20 4v7h-7" /></>,
  };
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</g></svg>;
}

function readSnapshots(): EditingSnapshot[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is EditingSnapshot => Boolean(
      item && typeof item === 'object' &&
      typeof (item as EditingSnapshot).id === 'string' &&
      typeof (item as EditingSnapshot).sourceText === 'string' &&
      Array.isArray((item as EditingSnapshot).result?.issues),
    ));
  } catch {
    return [];
  }
}

function readSession(snapshot: EditingSnapshot): AppliedEdit[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTHOR_EDITING_SESSION_KEY) || 'null') as SavedEditingSession | null;
    if (!parsed || parsed.snapshotId !== snapshot.id || parsed.sourceText !== snapshot.sourceText || !Array.isArray(parsed.applied)) return [];
    return parsed.applied;
  } catch {
    return [];
  }
}

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function AuthorEditingDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<EditingSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [applied, setApplied] = useState<AppliedEdit[]>([]);
  const [redoStack, setRedoStack] = useState<AppliedEdit[]>([]);
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState<'tracked' | 'clean' | ''>('');

  const selected = snapshots.find((snapshot) => snapshot.id === selectedId) || snapshots[0] || null;
  const sourceText = selected?.sourceText || '';
  const workingText = useMemo(() => composeWorkingText(sourceText, applied), [applied, sourceText]);
  const issueAnalyses = useMemo(() => {
    if (!selected) return [];
    return selected.result.issues.map((issue) => ({ issue, analysis: analyseIssueAnchor(sourceText, issue, applied) }));
  }, [applied, selected, sourceText]);
  const safeCount = issueAnalyses.filter(({ analysis }) => analysis.state === 'safe-exact' || analysis.state === 'safe-whitespace').length;
  const manualCount = issueAnalyses.filter(({ analysis }) => ['manual', 'missing', 'ambiguous', 'conflict'].includes(analysis.state)).length;

  useEffect(() => {
    if (!open) return;
    const next = readSnapshots();
    setSnapshots(next);
    const first = next[0];
    if (first) {
      setSelectedId(first.id);
      setApplied(readSession(first));
    } else {
      setSelectedId('');
      setApplied([]);
    }
    setRedoStack([]);
    setNotice('');
  }, [open]);

  useEffect(() => {
    if (!selected) return;
    const session: SavedEditingSession = {
      snapshotId: selected.id,
      sourceText: selected.sourceText,
      applied,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(AUTHOR_EDITING_SESSION_KEY, JSON.stringify(session));
  }, [applied, selected]);

  if (pathname === '/login') return null;

  function chooseSnapshot(snapshot: EditingSnapshot) {
    setSelectedId(snapshot.id);
    setApplied(readSession(snapshot));
    setRedoStack([]);
    setNotice('');
  }

  function applyIssue(issue: ReviewIssue) {
    if (!selected) return;
    const analysis = analyseIssueAnchor(sourceText, issue, applied);
    const edit = createAppliedEdit(issue, analysis);
    if (!edit) {
      setNotice(analysis.message);
      return;
    }
    setApplied((current) => [...current, edit]);
    setRedoStack([]);
    setNotice('建议已加入工作稿。写入工作台前仍可撤销。');
  }

  function applyAllSafe() {
    if (!selected) return;
    let next = [...applied];
    let added = 0;
    for (const issue of selected.result.issues) {
      const analysis = analyseIssueAnchor(sourceText, issue, next);
      const edit = createAppliedEdit(issue, analysis);
      if (edit) {
        next.push(edit);
        added += 1;
      }
    }
    setApplied(next);
    setRedoStack([]);
    setNotice(added ? `已加入 ${added} 条可唯一定位的建议；冲突和作者待补项已跳过。` : '当前没有新的可安全应用建议。');
  }

  function undo() {
    setApplied((current) => {
      const last = current[current.length - 1];
      if (!last) return current;
      setRedoStack((redo) => [...redo, last]);
      return current.slice(0, -1);
    });
    setNotice('已撤销最近一次修改。');
  }

  function redo() {
    setRedoStack((current) => {
      const last = current[current.length - 1];
      if (!last) return current;
      setApplied((edits) => [...edits, last]);
      return current.slice(0, -1);
    });
    setNotice('已恢复最近一次修改。');
  }

  function resetEditing() {
    setApplied([]);
    setRedoStack([]);
    window.localStorage.removeItem(AUTHOR_EDITING_SESSION_KEY);
    setNotice('已恢复为本次审校的原始稿件。');
  }

  function writeToWorkspace() {
    if (!selected) return;
    let existingDraft: Record<string, unknown> = {};
    try {
      existingDraft = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || '{}') as Record<string, unknown>;
    } catch {
      existingDraft = {};
    }
    const savedAt = new Date().toISOString();
    const decisions = { ...(selected.decisions || {}) };
    applied.forEach((edit) => { decisions[edit.issueId] = 'accepted'; });

    const nextDraft = {
      ...existingDraft,
      projectTitle: selected.projectTitle,
      taskType: selected.taskType,
      sourceText: workingText,
      supportingContext: selected.supportingContext || '',
      responseLocation: selected.responseLocation || '',
      targetJournal: selected.targetJournal || '',
      sectionType: selected.sectionType,
      reviewMode: selected.reviewMode,
      lockedTerms: selected.lockedTerms || [],
      savedAt,
      authorEditing: {
        snapshotId: selected.id,
        baseRequestId: selected.requestId || '',
        appliedEdits: applied,
        writtenAt: savedAt,
      },
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));

    const nextHistory = snapshots.map((snapshot) => snapshot.id === selected.id
      ? { ...snapshot, decisions, workingText, appliedEdits: applied }
      : snapshot);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    window.sessionStorage.setItem(HUB_VIEW_KEY, 'workspace');
    setOpen(false);
    window.location.assign('/');
  }

  async function downloadDocx(mode: 'tracked' | 'clean') {
    if (!selected) return;
    setExporting(mode);
    setNotice('');
    try {
      const decisions = { ...(selected.decisions || {}) };
      applied.forEach((edit) => { decisions[edit.issueId] = 'accepted'; });
      await exportAuthorDocx({
        mode,
        projectTitle: selected.projectTitle,
        targetJournal: selected.targetJournal,
        sectionLabel: SECTION_LABELS[selected.sectionType],
        sourceText,
        edits: applied,
        issues: selected.result.issues,
        decisions,
      });
      setNotice(mode === 'tracked' ? 'DOCX 修订痕迹文件已生成。' : 'DOCX 清洁稿已生成。');
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'DOCX 生成失败，请稍后重试。');
    } finally {
      setExporting('');
    }
  }

  return <div className={`author-editing-dock ${open ? 'is-open' : ''}`}>
    <button className="author-editing-trigger" onClick={() => setOpen(true)} type="button">
      <span><EditIcon name="edit" /></span>
      <span><b>作者修改台</b><small>应用建议 / DOCX</small></span>
    </button>

    {open ? <div className="author-editing-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section aria-label="作者修改工作台" aria-modal="true" className="author-editing-modal" role="dialog">
        <header className="author-editing-head">
          <div><span>Author editing · v1.2</span><h2>把审校建议安全写入工作稿</h2><p>仅自动应用能够唯一定位、没有范围冲突且不包含作者待补项的建议。</p></div>
          <button aria-label="关闭作者修改台" onClick={() => setOpen(false)} type="button"><EditIcon name="close" /></button>
        </header>

        {!selected ? <div className="author-editing-empty">
          <span><EditIcon name="edit" /></span><h3>尚无可编辑的审校记录</h3><p>先在 PaperLens 完成一次翻译、润色或投稿预检，系统才会建立可追踪的修改基线。</p><button onClick={() => setOpen(false)} type="button">返回工作台</button>
        </div> : <>
          <div className="author-editing-projectbar">
            <label>选择审校快照<select onChange={(event) => {
              const snapshot = snapshots.find((item) => item.id === event.target.value);
              if (snapshot) chooseSnapshot(snapshot);
            }} value={selected.id}>{snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.projectTitle} · {formatSavedAt(snapshot.savedAt)}</option>)}</select></label>
            <div><span>{SECTION_LABELS[selected.sectionType]}</span><span>{selected.result.scoreAfter}/100</span><span>{selected.result.issues.length} issues</span></div>
          </div>

          <div className="author-editing-metrics">
            <article><span>可安全应用</span><strong>{safeCount}</strong><small>唯一文本锚点</small></article>
            <article><span>已进入工作稿</span><strong>{applied.length}</strong><small>可撤销和重做</small></article>
            <article><span>需要人工处理</span><strong>{manualCount}</strong><small>缺失、冲突或不唯一</small></article>
            <article><span>工作稿变化</span><strong>{workingText.length - sourceText.length >= 0 ? '+' : ''}{workingText.length - sourceText.length}</strong><small>字符</small></article>
          </div>

          <div className="author-editing-toolbar">
            <button disabled={!applied.length} onClick={undo} type="button"><EditIcon name="undo" />撤销</button>
            <button disabled={!redoStack.length} onClick={redo} type="button"><EditIcon name="redo" />重做</button>
            <button disabled={!applied.length} onClick={resetEditing} type="button"><EditIcon name="reset" />恢复原稿</button>
            <button className="is-primary" disabled={!safeCount} onClick={applyAllSafe} type="button"><EditIcon name="check" />应用全部安全建议</button>
          </div>

          {notice ? <div className="author-editing-notice" role="status">{notice}</div> : null}

          <div className="author-editing-layout">
            <section className="author-working-copy">
              <div className="author-panel-head"><div><span>Working manuscript</span><h3>作者工作稿</h3></div><b>{workingText.length.toLocaleString()} chars</b></div>
              <div className="author-working-text">{workingText}</div>
              <div className="author-working-note"><EditIcon name="warning" /><p>修改台始终以本次审校的原始文本为锚点。重叠建议不会被自动合并，跨段落建议不会被自动替换。</p></div>
            </section>

            <section className="author-issue-panel">
              <div className="author-panel-head"><div><span>Issue-level decisions</span><h3>逐条应用建议</h3></div><b>{selected.result.issues.length}</b></div>
              <div className="author-issue-list">{issueAnalyses.map(({ issue, analysis }, index) => {
                const status = STATUS_LABELS[analysis.state];
                const canApply = analysis.state === 'safe-exact' || analysis.state === 'safe-whitespace';
                return <article className={`author-issue-card tone-${status.tone}`} key={issue.id}>
                  <header><span>{String(index + 1).padStart(2, '0')}</span><div><b>{issue.category}</b><small>{issue.agent} · {issue.severity} · {issue.location}</small></div><i>{status.label}</i></header>
                  <div className="author-change-pair"><div><span>Original</span><p>{issue.original || 'Not supplied'}</p></div><div><span>Suggested</span><p>{issue.revised || 'Author action required'}</p></div></div>
                  <footer><p>{analysis.message}</p><button disabled={!canApply} onClick={() => applyIssue(issue)} type="button">{analysis.state === 'applied' ? '已应用' : '应用到工作稿'}</button></footer>
                </article>;
              })}</div>
            </section>
          </div>

          <footer className="author-editing-actions">
            <div><b>Word 交付物</b><span>修订版使用 Word 原生插入/删除标记；未安全应用的问题保留在 Author Decision Appendix。</span></div>
            <div>
              <button disabled={Boolean(exporting)} onClick={() => void downloadDocx('clean')} type="button"><EditIcon name="download" />{exporting === 'clean' ? '生成中…' : 'DOCX 清洁稿'}</button>
              <button disabled={!applied.length || Boolean(exporting)} onClick={() => void downloadDocx('tracked')} type="button"><EditIcon name="download" />{exporting === 'tracked' ? '生成中…' : 'DOCX 修订痕迹'}</button>
              <button className="is-primary" disabled={!applied.length} onClick={writeToWorkspace} type="button">写入 PaperLens 工作台 <span>→</span></button>
            </div>
          </footer>
        </>}
      </section>
    </div> : null}
  </div>;
}
