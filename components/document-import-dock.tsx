'use client';

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { usePathname } from 'next/navigation';
import {
  DOCUMENT_MAX_BYTES,
  WORKSPACE_TEXT_LIMIT,
  ingestResearchDocument,
  type IngestedDocument,
  type IngestedSection,
} from '@/lib/document-ingestion';
import { bindOriginalDocxSource, saveOriginalDocx } from '@/lib/original-docx-store';
import type { ReviewMode, WorkspaceTask } from '@/lib/types';

const DRAFT_KEY = 'scholarforge-os-paperlens-draft-v1';
const HUB_VIEW_KEY = 'scholarforge-os-hub-view-v1';
const LAST_IMPORT_KEY = 'scholarforge-os-document-import-v1';

const TASK_LABELS: Record<WorkspaceTask, string> = {
  translate: '科研中译英',
  polish: '英文保守润色',
  precheck: '投稿前预检',
  'review-response': '审稿回复助手',
};

const MODE_LABELS: Record<ReviewMode, string> = {
  conservative: '保守模式',
  balanced: '平衡模式',
  deep: '深度模式',
};

const SECTION_LABELS = {
  general: '通用段落',
  abstract: '摘要',
  introduction: '引言',
  methods: '方法',
  results: '结果',
  discussion: '讨论',
  conclusion: '结论',
};

function readableSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeParseDraft() {
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function ImportIcon({ name }: { name: 'upload' | 'file' | 'shield' | 'check' | 'close' }) {
  const paths = {
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 15v5h16v-5" /></>,
    file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6z" /><path d="m9 12 2 2 4-5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</g></svg>;
}

export function DocumentImportDock() {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [document, setDocument] = useState<IngestedDocument | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [taskType, setTaskType] = useState<WorkspaceTask>('precheck');
  const [reviewMode, setReviewMode] = useState<ReviewMode>('balanced');
  const [error, setError] = useState('');

  const availableSections = useMemo(() => {
    if (!document) return [];
    const sections = [...document.sections];
    if (document.fullText.length >= 40 && document.fullText.length <= WORKSPACE_TEXT_LIMIT && document.sections.length > 1) {
      sections.unshift({
        id: 'full-document',
        title: '全文（已提取文本）',
        sectionType: 'general',
        text: document.fullText,
        charCount: document.fullText.length,
        sourceLabel: document.pageCount ? `${document.pageCount} pages` : 'Complete document',
      });
    }
    return sections;
  }, [document]);

  const selected = availableSections.find((section) => section.id === selectedId) || availableSections[0];

  if (pathname === '/login') return null;

  function reset() {
    setDocument(null);
    setSourceFile(null);
    setSelectedId('');
    setError('');
    setProcessing(false);
    setImporting(false);
    setDragging(false);
  }

  async function processFile(file?: File) {
    if (!file) return;
    setProcessing(true);
    setError('');
    setDocument(null);
    setSourceFile(null);
    try {
      const next = await ingestResearchDocument(file);
      if (!next.fullText.trim()) throw new Error('没有提取到可用文字。扫描版 PDF 暂不支持 OCR。');
      if (!next.sections.length) throw new Error('没有识别到可导入的正文段落。');
      setSourceFile(file);
      setDocument(next);
      setSelectedId(next.sections[0].id);
      setTaskType(next.suggestedTask);
      setReviewMode(next.suggestedMode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '文档解析失败，请改用可复制文本的 PDF 或 DOCX。');
    } finally {
      setProcessing(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    void processFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void processFile(event.dataTransfer.files?.[0]);
  }

  async function importSelection(section: IngestedSection) {
    if (!document) return;
    setImporting(true);
    setError('');
    try {
      const existing = safeParseDraft();
      const savedAt = new Date().toISOString();
      let originalPackage: Record<string, unknown> = { stored: false };
      if (document.fileType === 'docx' && sourceFile) {
        try {
          const stored = await saveOriginalDocx(sourceFile);
          const binding = await bindOriginalDocxSource(stored, section.text, section.title, section.sourceLabel);
          originalPackage = {
            stored: true,
            documentId: stored.id,
            fingerprint: binding.fingerprint,
            storage: 'browser-indexeddb',
          };
        } catch (storageError) {
          originalPackage = {
            stored: false,
            error: storageError instanceof Error ? storageError.message : '浏览器无法保留原始 DOCX。',
          };
        }
      }
      const nextDraft = {
        projectTitle: `${document.title || 'Imported manuscript'} · ${section.title}`,
        taskType,
        sourceText: section.text,
        supportingContext: '',
        responseLocation: '',
        targetJournal: typeof existing.targetJournal === 'string' ? existing.targetJournal : '',
        sectionType: section.sectionType,
        reviewMode,
        lockedTerms: Array.isArray(existing.lockedTerms) ? existing.lockedTerms : [],
        savedAt,
        importedDocument: {
          fileName: document.fileName,
          fileType: document.fileType,
          sectionTitle: section.title,
          sourceLabel: section.sourceLabel,
          importedAt: savedAt,
          originalPackage,
        },
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
      window.localStorage.setItem(LAST_IMPORT_KEY, JSON.stringify(nextDraft.importedDocument));
      window.sessionStorage.setItem(HUB_VIEW_KEY, 'workspace');
      setOpen(false);
      if (window.location.pathname === '/') window.location.reload();
      else window.location.assign('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败，请重新选择章节。');
    } finally {
      setImporting(false);
    }
  }

  return <div className={`document-import-dock ${open ? 'is-open' : ''}`}>
    <button className="document-import-trigger" onClick={() => setOpen(true)} type="button">
      <span><ImportIcon name="upload" /></span>
      <span><b>导入论文</b><small>DOCX / PDF</small></span>
    </button>

    {open ? <div className="document-import-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section aria-label="导入科研文档" aria-modal="true" className="document-import-modal" role="dialog">
        <header className="document-import-head">
          <div><span>Document ingestion · v1.3</span><h2>导入论文并选择审校章节</h2><p>DOCX 原始压缩包会保存在当前浏览器，用于后续原文件修订补丁；不会自动上传到 ScholarForge 服务器。</p></div>
          <button aria-label="关闭文档导入" onClick={() => setOpen(false)} type="button"><ImportIcon name="close" /></button>
        </header>

        {!document ? <div className="document-import-start">
          <div
            className={`document-dropzone ${dragging ? 'is-dragging' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            {processing ? <><span className="document-import-spinner" /><h3>正在本地解析文档</h3><p>提取正文、识别标题层级并拆分可审校章节……</p></> : <>
              <span className="document-drop-icon"><ImportIcon name="upload" /></span>
              <h3>拖入 DOCX 或文字型 PDF</h3>
              <p>也可以从电脑选择文件，单个文件最大 {readableSize(DOCUMENT_MAX_BYTES)}。</p>
              <button onClick={() => inputRef.current?.click()} type="button">选择论文文件</button>
              <input accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" hidden onChange={onFileChange} ref={inputRef} type="file" />
            </>}
          </div>
          <div className="document-import-boundaries">
            <article><span><ImportIcon name="shield" /></span><div><b>本地解析与原包保存</b><p>DOCX 文件保存在当前浏览器 IndexedDB；只有你选中的文本在启动任务后进入百炼。PDF 仍只提取文字，不保留原文件。</p></div></article>
            <article><span><ImportIcon name="file" /></span><div><b>结构边界</b><p>DOCX 可读取语义标题；PDF 按页面文字抽取。公式、表格、双栏顺序和扫描图像需要作者核对。</p></div></article>
          </div>
          {error ? <div className="document-import-error" role="alert">{error}<button onClick={reset} type="button">重新选择</button></div> : null}
        </div> : <div className="document-import-review">
          <aside className="document-file-summary">
            <div className="document-file-mark"><ImportIcon name="file" /></div>
            <div><span>{document.fileType.toUpperCase()} · {document.pageCount ? `${document.pageCount} pages` : 'Word document'}</span><h3>{document.fileName}</h3><p>{document.fullText.length.toLocaleString()} 字符 · {document.sections.length} 个可审校片段</p></div>
            <button onClick={reset} type="button">更换文件</button>
          </aside>

          <div className="document-import-layout">
            <section className="document-section-picker">
              <div className="document-panel-head"><div><span>01 · Detected sections</span><h3>选择导入范围</h3></div><b>{availableSections.length}</b></div>
              <div className="document-section-list">{availableSections.map((section) => <button className={selected?.id === section.id ? 'is-selected' : ''} key={section.id} onClick={() => setSelectedId(section.id)} type="button">
                <span>{selected?.id === section.id ? <ImportIcon name="check" /> : null}</span>
                <div><b>{section.title}</b><small>{SECTION_LABELS[section.sectionType]} · {section.sourceLabel}</small></div>
                <i>{section.charCount.toLocaleString()}</i>
              </button>)}</div>
            </section>

            <section className="document-preview-panel">
              <div className="document-panel-head"><div><span>02 · Text preview</span><h3>{selected?.title || '选择一个章节'}</h3></div><b>{selected?.charCount.toLocaleString() || 0} / {WORKSPACE_TEXT_LIMIT.toLocaleString()}</b></div>
              <div className="document-preview-text">{selected?.text || ''}</div>
              <div className="document-import-settings">
                <label>进入工作流<select onChange={(event) => setTaskType(event.target.value as WorkspaceTask)} value={taskType}><option value="translate">科研中译英</option><option value="polish">英文保守润色</option><option value="precheck">投稿前预检</option></select></label>
                <label>处理强度<select onChange={(event) => setReviewMode(event.target.value as ReviewMode)} value={reviewMode}><option value="conservative">保守模式</option><option value="balanced">平衡模式</option><option value="deep">深度模式</option></select></label>
              </div>
            </section>
          </div>

          {document.warnings.length ? <section className="document-warning-list"><div><span>Extraction notes</span><h3>导入前请核对</h3></div><ul>{document.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
          {error ? <div className="document-import-error" role="alert">{error}</div> : null}

          <footer className="document-import-actions">
            <div><b>{selected ? `${TASK_LABELS[taskType]} · ${SECTION_LABELS[selected.sectionType]} · ${MODE_LABELS[reviewMode]}` : '请选择章节'}</b><span>{document.fileType === 'docx' ? '导入时会在本机保留原 DOCX 包，后续可生成原文件修订版。' : '导入后仍可在 PaperLens 中编辑文本、期刊、术语锁和模式。'}</span></div>
            <button disabled={!selected || selected.charCount > WORKSPACE_TEXT_LIMIT || importing} onClick={() => selected && void importSelection(selected)} type="button">{importing ? '正在保留原包…' : '导入所选章节'} <span>→</span></button>
          </footer>
        </div>}
      </section>
    </div> : null}
  </div>;
}
