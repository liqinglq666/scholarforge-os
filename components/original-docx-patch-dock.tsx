'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AUTHOR_EDITING_SESSION_KEY, type AppliedEdit } from '@/lib/author-editing';
import { findOriginalDocxBinding, loadOriginalDocx, type OriginalDocxBinding } from '@/lib/original-docx-store';
import { patchOriginalDocx, type OriginalDocxPatchReport } from '@/lib/original-docx-patcher';
import type { IssueDecision, ReviewMode, ReviewResult, ReviewSection, TerminologyLock, WorkspaceTask } from '@/lib/types';

const HISTORY_KEY = 'scholarforge-os-paperlens-history-v1';

interface PatchSnapshot {
  id: string;
  projectTitle: string;
  taskType: WorkspaceTask;
  sourceText: string;
  targetJournal: string;
  sectionType: ReviewSection;
  reviewMode: ReviewMode;
  lockedTerms: TerminologyLock[];
  result: ReviewResult;
  decisions: Record<string, IssueDecision>;
  savedAt: string;
  appliedEdits?: AppliedEdit[];
}

interface EditingSession {
  snapshotId: string;
  sourceText: string;
  applied: AppliedEdit[];
}

const SECTION_LABELS: Record<ReviewSection, string> = {
  general: '通用段落',
  abstract: '摘要',
  introduction: '引言',
  methods: '方法',
  results: '结果',
  discussion: '讨论',
  conclusion: '结论',
};

function PatchIcon({ name }: { name: 'package' | 'close' | 'download' | 'shield' | 'warning' | 'check' }) {
  const paths: Record<string, ReactNode> = {
    package: <><path d="m4 7 8-4 8 4-8 4z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 21h16" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6z" /><path d="m9 12 2 2 4-5" /></>,
    warning: <><path d="M12 3 2.8 20h18.4z" /><path d="M12 9v4M12 17h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</g></svg>;
}

function readSnapshots() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PatchSnapshot => Boolean(
      item && typeof item === 'object' &&
      typeof (item as PatchSnapshot).id === 'string' &&
      typeof (item as PatchSnapshot).sourceText === 'string' &&
      Array.isArray((item as PatchSnapshot).result?.issues),
    ));
  } catch {
    return [];
  }
}

function readAppliedEdits(snapshot: PatchSnapshot) {
  if (Array.isArray(snapshot.appliedEdits) && snapshot.appliedEdits.length) return snapshot.appliedEdits;
  if (typeof window === 'undefined') return [];
  try {
    const session = JSON.parse(window.localStorage.getItem(AUTHOR_EDITING_SESSION_KEY) || 'null') as EditingSession | null;
    if (session?.snapshotId === snapshot.id && session.sourceText === snapshot.sourceText && Array.isArray(session.applied)) return session.applied;
  } catch {
    // Ignore malformed browser-local editing sessions.
  }
  return [];
}

function formatSavedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function OriginalDocxPatchDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<PatchSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [binding, setBinding] = useState<OriginalDocxBinding | null>(null);
  const [bindingState, setBindingState] = useState<'idle' | 'checking' | 'available' | 'missing'>('idle');
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [report, setReport] = useState<OriginalDocxPatchReport | null>(null);

  const selected = snapshots.find((snapshot) => snapshot.id === selectedId) || snapshots[0] || null;
  const applied = useMemo(() => selected ? readAppliedEdits(selected) : [], [selected, open]);

  useEffect(() => {
    if (!open) return;
    const next = readSnapshots();
    setSnapshots(next);
    setSelectedId(next[0]?.id || '');
    setNotice('');
    setReport(null);
  }, [open]);

  useEffect(() => {
    let alive = true;
    if (!open || !selected) {
      setBinding(null);
      setBindingState('idle');
      return () => { alive = false; };
    }
    setBindingState('checking');
    setBinding(null);
    void findOriginalDocxBinding(selected.sourceText)
      .then((next) => {
        if (!alive) return;
        setBinding(next);
        setBindingState(next ? 'available' : 'missing');
      })
      .catch(() => {
        if (!alive) return;
        setBinding(null);
        setBindingState('missing');
      });
    return () => { alive = false; };
  }, [open, selected]);

  if (pathname === '/login') return null;

  async function exportOriginalPatch() {
    if (!selected || !binding || !applied.length) return;
    setExporting(true);
    setNotice('');
    setReport(null);
    try {
      const original = await loadOriginalDocx(binding.documentId);
      if (!original) throw new Error('浏览器中已找不到原始 DOCX，可能已被清理或来自另一台设备。');
      const result = await patchOriginalDocx(original, applied);
      downloadBlob(result.blob, result.fileName);
      setReport(result.report);
      setNotice(result.report.skipped.length
        ? `已写回 ${result.report.patchedIssueIds.length} 条修改，另有 ${result.report.skipped.length} 条因结构风险被跳过。`
        : `已将 ${result.report.patchedIssueIds.length} 条修改写入原始 DOCX 修订标记。`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : '原始 DOCX 补丁生成失败。');
    } finally {
      setExporting(false);
    }
  }

  return <div className={`original-docx-patch-dock ${open ? 'is-open' : ''}`}>
    <button className="original-docx-patch-trigger" onClick={() => setOpen(true)} type="button">
      <span><PatchIcon name="package" /></span>
      <span><b>原稿补丁</b><small>保留 Word 结构</small></span>
    </button>

    {open ? <div className="original-docx-patch-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section aria-label="原始 DOCX 补丁工作台" aria-modal="true" className="original-docx-patch-modal" role="dialog">
        <header className="original-docx-patch-head">
          <div><span>Original package patching · v1.3</span><h2>把作者确认修改写回原始 DOCX</h2><p>保留原文件压缩包中的样式、图片、表格、公式、页眉页脚和关系文件，只修改能唯一定位的普通正文段落。</p></div>
          <button aria-label="关闭原稿补丁" onClick={() => setOpen(false)} type="button"><PatchIcon name="close" /></button>
        </header>

        {!selected ? <div className="original-docx-patch-empty">
          <span><PatchIcon name="package" /></span><h3>尚无可补丁的审校记录</h3><p>先导入 DOCX、完成四 Agent 审校，并在作者修改台应用至少一条安全建议。</p>
        </div> : <>
          <div className="original-docx-patch-projectbar">
            <label>选择审校快照<select onChange={(event) => { setSelectedId(event.target.value); setReport(null); setNotice(''); }} value={selected.id}>{snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.projectTitle} · {formatSavedAt(snapshot.savedAt)}</option>)}</select></label>
            <div><span>{SECTION_LABELS[selected.sectionType]}</span><span>{selected.result.scoreAfter}/100</span><span>{applied.length} applied</span></div>
          </div>

          <div className="original-docx-patch-grid">
            <section className="original-docx-source-card">
              <div className={`original-docx-source-icon is-${bindingState}`}><PatchIcon name={bindingState === 'available' ? 'check' : bindingState === 'missing' ? 'warning' : 'package'} /></div>
              <div><span>Original package</span><h3>{bindingState === 'checking' ? '正在检查原始文件' : binding?.fileName || '未找到原始 DOCX 绑定'}</h3><p>{binding
                ? `${binding.sectionTitle} · ${binding.sourceLabel} · 原文件只保存在当前浏览器 IndexedDB`
                : '只有通过 v1.3 之后的“导入论文”入口选择 DOCX，且审校原文未被手动改写，才能建立原文件绑定。'}</p></div>
            </section>

            <section className="original-docx-preservation-card">
              <div><span>Preservation strategy</span><h3>保留包，只补正文 XML</h3></div>
              <ul><li><PatchIcon name="shield" />图片、表格、公式、样式、页眉页脚与引用关系继续保留在原包中</li><li><PatchIcon name="shield" />普通正文使用 Word 原生 w:del / w:ins 修订标记</li><li><PatchIcon name="warning" />表格、公式、域、链接、批注、已有修订和复杂内联结构自动跳过</li></ul>
            </section>
          </div>

          <div className="original-docx-patch-metrics">
            <article><span>作者已应用</span><strong>{applied.length}</strong><small>来自 v1.2 修改台</small></article>
            <article><span>原包绑定</span><strong>{bindingState === 'available' ? 'YES' : '—'}</strong><small>当前浏览器本地</small></article>
            <article><span>正文问题</span><strong>{selected.result.issues.length}</strong><small>未安全写回的仍保留</small></article>
          </div>

          {notice ? <div className="original-docx-patch-notice" role="status">{notice}</div> : null}

          {report ? <section className="original-docx-patch-report">
            <header><div><span>Patch report</span><h3>原文件补丁报告</h3></div><b>{report.patchedIssueIds.length}/{applied.length}</b></header>
            <div className="original-docx-report-stats"><span>已写回 <strong>{report.patchedIssueIds.length}</strong></span><span>已跳过 <strong>{report.skipped.length}</strong></span><span>保留包内条目 <strong>{report.preservedEntries}</strong></span></div>
            {report.skipped.length ? <ul>{report.skipped.map((item) => <li key={`${item.issueId}-${item.reason}`}><PatchIcon name="warning" /><span><b>{item.issueId}</b>{item.reason}</span></li>)}</ul> : <p className="original-docx-all-safe"><PatchIcon name="check" />所有作者已应用修改均成功写回原 DOCX。</p>}
          </section> : null}

          <footer className="original-docx-patch-actions">
            <div><b>不会上传原文件</b><span>读取、解压、XML 补丁和重新打包均在当前浏览器完成。</span></div>
            <button disabled={!binding || !applied.length || exporting} onClick={() => void exportOriginalPatch()} type="button"><PatchIcon name="download" />{exporting ? '正在补丁并打包…' : '下载原文件修订版 DOCX'}</button>
          </footer>
        </>}
      </section>
    </div> : null}
  </div>;
}
