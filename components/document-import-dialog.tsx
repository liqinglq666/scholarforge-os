'use client';

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import {
  DOCUMENT_MAX_BYTES,
  WORKSPACE_TEXT_LIMIT,
  ingestResearchDocument,
  type IngestedDocument,
  type IngestedSection,
} from '@/lib/document-ingestion';
import { MODE_LABELS, SECTION_LABELS, WORKFLOW_LABELS } from '@/lib/app-config';
import type { WorkspaceDraft } from '@/lib/workspace-schema';
import type { ReviewMode, WorkspaceTask } from '@/lib/types';

interface DocumentImportDialogProps {
  open: boolean;
  onClose(): void;
  onImported(draft: WorkspaceDraft): void;
  existingDraft?: WorkspaceDraft | null;
}

function readableSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentImportDialog({ open, onClose, onImported, existingDraft }: DocumentImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
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

  if (!open) return null;

  function reset() {
    setDocument(null);
    setSelectedId('');
    setError('');
    setProcessing(false);
    setDragging(false);
  }

  async function processFile(file?: File) {
    if (!file) return;
    setProcessing(true);
    setError('');
    setDocument(null);
    try {
      const next = await ingestResearchDocument(file);
      if (!next.fullText.trim()) throw new Error('没有提取到可用文字。扫描型 PDF 暂不支持 OCR。');
      if (!next.sections.length) throw new Error('没有识别到可导入的正文段落。');
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

  function importSelection(section: IngestedSection) {
    if (!document) return;
    const savedAt = new Date().toISOString();
    onImported({
      ...existingDraft,
      projectTitle: `${document.title || 'Imported manuscript'} · ${section.title}`,
      taskType,
      sourceText: section.text,
      supportingContext: '',
      responseLocation: '',
      targetJournal: typeof existingDraft?.targetJournal === 'string' ? existingDraft.targetJournal : '',
      sectionType: section.sectionType,
      reviewMode,
      lockedTerms: Array.isArray(existingDraft?.lockedTerms) ? existingDraft.lockedTerms : [],
      savedAt,
      importedDocument: {
        fileName: document.fileName,
        fileType: document.fileType,
        sectionTitle: section.title,
        sourceLabel: section.sourceLabel,
        importedAt: savedAt,
      },
    });
    onClose();
    reset();
  }

  return (
    <div className="sf-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="import-title" aria-modal="true" className="sf-dialog sf-import-dialog" role="dialog">
        <header className="sf-dialog-header">
          <div>
            <span className="sf-eyebrow">Document import</span>
            <h2 id="import-title">导入论文并选择审阅范围</h2>
            <p>文档在浏览器中解析；只有选中的文本会在启动工作流后发送至服务端。</p>
          </div>
          <button aria-label="关闭导入窗口" className="sf-icon-button" onClick={onClose} type="button"><Icon name="close" /></button>
        </header>

        {!document ? (
          <div className="sf-import-start">
            <div
              className={`sf-dropzone ${dragging ? 'is-dragging' : ''}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              {processing ? (
                <><span className="sf-spinner" /><h3>正在本地解析文档</h3><p>提取正文、识别章节并建立可审阅文本。</p></>
              ) : (
                <>
                  <span className="sf-dropzone-icon"><Icon name="import" size={24} /></span>
                  <h3>拖入 DOCX 或文字型 PDF</h3>
                  <p>单个文件最大 {readableSize(DOCUMENT_MAX_BYTES)}。扫描型 PDF、复杂公式和双栏版式需要人工核对。</p>
                  <button className="sf-button is-primary" onClick={() => inputRef.current?.click()} type="button">选择文件</button>
                  <input accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" hidden onChange={onFileChange} ref={inputRef} type="file" />
                </>
              )}
            </div>
            <div className="sf-boundary-grid">
              <article><Icon name="shield" /><div><b>本地解析</b><p>原始文件不进入云端存储，选中范围可在工作台继续编辑。</p></div></article>
              <article><Icon name="document" /><div><b>明确边界</b><p>DOCX 标题可识别；PDF 按页面提取文字。当前不提供 OCR。</p></div></article>
            </div>
            {error ? <div className="sf-alert is-danger" role="alert"><Icon name="warning" />{error}<button onClick={reset} type="button">重新选择</button></div> : null}
          </div>
        ) : (
          <div className="sf-import-review">
            <div className="sf-import-filebar">
              <span><Icon name="file" /></span>
              <div><b>{document.fileName}</b><small>{document.fileType.toUpperCase()} · {document.fullText.length.toLocaleString()} 字符 · {document.sections.length} 个片段</small></div>
              <button className="sf-button is-ghost" onClick={reset} type="button">更换文件</button>
            </div>
            <div className="sf-import-grid">
              <section className="sf-import-sections">
                <header><span>识别范围</span><b>{availableSections.length}</b></header>
                <div>{availableSections.map((section) => (
                  <button className={selected?.id === section.id ? 'is-selected' : ''} key={section.id} onClick={() => setSelectedId(section.id)} type="button">
                    <span>{selected?.id === section.id ? <Icon name="check" size={15} /> : null}</span>
                    <div><b>{section.title}</b><small>{SECTION_LABELS[section.sectionType]} · {section.sourceLabel}</small></div>
                    <i>{section.charCount.toLocaleString()}</i>
                  </button>
                ))}</div>
              </section>
              <section className="sf-import-preview">
                <header><div><span>文本预览</span><b>{selected?.title || '请选择范围'}</b></div><small>{selected?.charCount.toLocaleString() || 0} / {WORKSPACE_TEXT_LIMIT.toLocaleString()}</small></header>
                <div className="sf-import-preview-text">{selected?.text || ''}</div>
                <div className="sf-form-grid is-two">
                  <label><span>工作流</span><select onChange={(event) => setTaskType(event.target.value as WorkspaceTask)} value={taskType}>{Object.entries(WORKFLOW_LABELS).filter(([key]) => key !== 'review-response').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label><span>处理强度</span><select onChange={(event) => setReviewMode(event.target.value as ReviewMode)} value={reviewMode}>{Object.entries(MODE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                </div>
              </section>
            </div>
            {document.warnings.length ? <details className="sf-details"><summary>解析提示（{document.warnings.length}）</summary><ul>{document.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
            <footer className="sf-dialog-footer">
              <p>{selected ? `${WORKFLOW_LABELS[taskType]} · ${SECTION_LABELS[selected.sectionType]} · ${MODE_LABELS[reviewMode]}` : '请选择导入范围'}</p>
              <button className="sf-button is-primary" disabled={!selected || selected.charCount > WORKSPACE_TEXT_LIMIT} onClick={() => selected && importSelection(selected)} type="button">导入所选范围 <Icon name="arrow-right" /></button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
