'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import {
  MAX_SOURCE_CHARACTERS,
  MIN_SOURCE_CHARACTERS,
  SECTION_OPTIONS,
  TASK_DESCRIPTIONS,
  TASK_LABELS,
} from '@/lib/config';
import { RESEARCH_EXAMPLES, type ResearchExample } from '@/lib/examples';
import { extractDocx, type DocxImportResult } from '@/lib/documents/docx';
import type { ReviewServiceStatus, TaskType, TerminologyLock, WorkspaceDraft } from '@/lib/types';
import { StatusBanner } from '@/components/feedback/status-banner';

const TASKS = Object.keys(TASK_LABELS) as TaskType[];

export function TaskSetup({
  draft,
  service,
  serviceLoading,
  analyzing,
  onChange,
  onAnalyze,
}: {
  draft: WorkspaceDraft;
  service: ReviewServiceStatus | null;
  serviceLoading: boolean;
  analyzing: boolean;
  onChange: (patch: Partial<WorkspaceDraft>) => void;
  onAnalyze: () => void;
}) {
  const confirmRef = useRef<HTMLDialogElement>(null);
  const [importResult, setImportResult] = useState<DocxImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [termSource, setTermSource] = useState('');
  const [termPreferred, setTermPreferred] = useState('');
  const [loadedExampleId, setLoadedExampleId] = useState('');

  const textLength = draft.sourceText.length;
  const inputValid = textLength >= MIN_SOURCE_CHARACTERS && textLength <= MAX_SOURCE_CHARACTERS;
  const canAnalyze = Boolean(service?.configured && inputValid && !analyzing);
  const disabledReason = serviceLoading
    ? '正在确认分析服务状态…'
    : !service?.configured
      ? '分析服务未配置。文本仍会保存在此浏览器。'
      : textLength < MIN_SOURCE_CHARACTERS
        ? `还需要 ${MIN_SOURCE_CHARACTERS - textLength} 个字符。`
        : textLength > MAX_SOURCE_CHARACTERS
          ? `超出 ${textLength - MAX_SOURCE_CHARACTERS} 个字符，请缩短正文。`
          : '';

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      setImportResult(await extractDocx(file));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'DOCX 解析失败，请改用粘贴文本。');
    } finally {
      setImporting(false);
    }
  }

  function selectSection(index: number) {
    const section = importResult?.sections[index];
    if (!section || !importResult) return;
    if (section.text.length > MAX_SOURCE_CHARACTERS) {
      setImportError(`所选章节有 ${section.text.length.toLocaleString()} 个字符，请先缩短到 ${MAX_SOURCE_CHARACTERS.toLocaleString()} 个字符。`);
      return;
    }
    onChange({
      projectName: draft.projectName || importResult.title,
      sectionType: section.sectionType,
      sourceText: section.text,
      importedDocument: {
        fileName: importResult.fileName,
        importedAt: new Date().toISOString(),
        warnings: importResult.warnings,
      },
    });
    setLoadedExampleId('');
    setImportResult(null);
  }

  function loadExample(example: ResearchExample) {
    if (draft.sourceText.trim() && !window.confirm('载入示例会替换当前输入文本和设置。确定继续吗？')) return;
    onChange({
      projectName: example.projectName,
      taskType: example.taskType,
      sectionType: example.sectionType,
      targetJournal: example.targetJournal,
      sourceText: example.sourceText,
      terminologyLocks: example.terminologyLocks.map((term) => ({ ...term })),
      importedDocument: undefined,
    });
    setImportResult(null);
    setImportError('');
    setLoadedExampleId(example.id);
  }

  function addTerm() {
    const source = termSource.trim();
    const preferred = termPreferred.trim();
    if (!source || !preferred || draft.terminologyLocks.length >= 20) return;
    const next: TerminologyLock = { id: crypto.randomUUID(), source, preferred };
    onChange({ terminologyLocks: [...draft.terminologyLocks, next] });
    setTermSource('');
    setTermPreferred('');
  }

  return (
    <div className="workspace-setup quick-review-setup">
      <div className="page-heading compact quick-review-heading">
        <div><span className="eyebrow">快速审校</span><h1>粘贴文本，选择任务，开始分析</h1></div>
        <p>主要流程只保留三个动作。章节类型、期刊、DOCX 和术语等选项收进高级设置。</p>
      </div>

      {!serviceLoading && service && !service.configured ? (
        <StatusBanner tone="warning" title="分析服务未配置">{service.message}</StatusBanner>
      ) : null}

      <section aria-labelledby="quick-task-title" className="panel quick-review-panel">
        <div className="quick-task-heading">
          <div><span className="eyebrow">1 · 选择任务</span><h2 id="quick-task-title">你现在想完成什么？</h2></div>
          <span>{TASK_DESCRIPTIONS[draft.taskType]}</span>
        </div>
        <div className="quick-task-switcher" role="radiogroup" aria-label="任务类型">
          {TASKS.map((task) => (
            <label className={draft.taskType === task ? 'selected' : ''} key={task}>
              <input checked={draft.taskType === task} name="taskType" onChange={() => onChange({ taskType: task })} type="radio" />
              <strong>{TASK_LABELS[task]}</strong>
            </label>
          ))}
        </div>

        <label className="source-field quick-source" htmlFor="source-text">
          <span>2 · {draft.taskType === 'translate' ? '粘贴中文科研原文' : '粘贴英文论文原文'}</span>
          <textarea
            aria-describedby="character-status"
            id="source-text"
            onChange={(event) => {
              setLoadedExampleId('');
              onChange({ sourceText: event.target.value, importedDocument: undefined });
            }}
            placeholder={draft.taskType === 'translate' ? '粘贴需要翻译的摘要、方法、结果或讨论段落…' : 'Paste the manuscript passage that needs careful review…'}
            spellCheck={draft.taskType !== 'translate'}
            value={draft.sourceText}
          />
        </label>
        <div className={textLength > MAX_SOURCE_CHARACTERS ? 'character-count over' : 'character-count'} id="character-status">
          <span>{textLength < MIN_SOURCE_CHARACTERS ? `至少 ${MIN_SOURCE_CHARACTERS} 个字符` : '长度符合要求'}</span>
          <strong>{textLength.toLocaleString()} / {MAX_SOURCE_CHARACTERS.toLocaleString()}</strong>
        </div>

        <div className="quick-review-submit">
          <div><strong>3 · 检查并开始</strong><span>{disabledReason || `将发送 ${textLength.toLocaleString()} 个字符及 ${draft.terminologyLocks.length} 条术语规则`}</span></div>
          <button className="primary-button" disabled={!canAnalyze} onClick={() => confirmRef.current?.showModal()} type="button">开始分析</button>
        </div>
      </section>

      <details className="panel progressive-panel" open={Boolean(importResult || importError)}>
        <summary><span><strong>高级设置与 DOCX 导入</strong><small>项目名、章节类型、目标期刊、术语规则</small></span></summary>
        <div className="progressive-content">
          <div className="form-grid two-columns">
            <label><span>任务名称（可选）</span><input maxLength={120} onChange={(event) => onChange({ projectName: event.target.value })} placeholder="例如：Discussion 段落润色" value={draft.projectName} /></label>
            <label><span>章节类型</span><select onChange={(event) => onChange({ sectionType: event.target.value as WorkspaceDraft['sectionType'] })} value={draft.sectionType}>{SECTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="full-width"><span>目标期刊或写作语境（可选）</span><input maxLength={160} onChange={(event) => onChange({ targetJournal: event.target.value })} placeholder="例如：目标期刊名称" value={draft.targetJournal} /></label>
          </div>

          <div className="source-toolbar">
            <label className="file-button"><input accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} type="file" />{importing ? '正在提取正文…' : '从 DOCX 选择章节'}</label>
            <span>原始 DOCX 不上传；仅在浏览器中提取文本。</span>
          </div>
          {importError ? <p className="field-error" role="alert">{importError}</p> : null}
          {importResult ? (
            <div className="import-preview" aria-live="polite">
              <div><strong>已提取：{importResult.fileName}</strong><button onClick={() => setImportResult(null)} type="button">取消</button></div>
              <p>请选择一个章节填入快速审校。</p>
              <div className="section-list">{importResult.sections.map((section, index) => <button key={section.id} onClick={() => selectSection(index)} type="button"><span><b>{section.title}</b><small>{section.characterCount.toLocaleString()} 字符</small></span><span>使用本章节</span></button>)}</div>
              <ul>{importResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : null}

          <div className="advanced-terms">
            <div><strong>本次术语规则</strong><span>适合材料名、缩写、量表和算法名称。</span></div>
            <div className="term-entry">
              <label><span>原词</span><input maxLength={120} onChange={(event) => setTermSource(event.target.value)} value={termSource} /></label>
              <label><span>指定表达</span><input maxLength={160} onChange={(event) => setTermPreferred(event.target.value)} value={termPreferred} /></label>
              <button disabled={!termSource.trim() || !termPreferred.trim() || draft.terminologyLocks.length >= 20} onClick={addTerm} type="button">添加</button>
            </div>
            {draft.terminologyLocks.length ? <ul className="term-list">{draft.terminologyLocks.map((term) => <li key={term.id}><span><b>{term.source}</b><small>必须使用：{term.preferred}</small></span><button aria-label={`删除术语 ${term.source}`} onClick={() => onChange({ terminologyLocks: draft.terminologyLocks.filter((item) => item.id !== term.id) })} type="button">删除</button></li>)}</ul> : <p className="empty-inline">没有额外术语规则。</p>}
          </div>
        </div>
      </details>

      <details className="panel progressive-panel examples-panel">
        <summary><span><strong>第一次使用？载入示例</strong><small>示例仅填入本地草稿，不会自动发送</small></span></summary>
        <div className="progressive-content">
          <div className="workspace-example-grid">
            {RESEARCH_EXAMPLES.map((example) => (
              <button aria-label={`使用示例：${example.discipline}，${example.title}`} className="workspace-example-card" key={example.id} onClick={() => loadExample(example)} type="button">
                <span>{example.discipline} · {TASK_LABELS[example.taskType]}</span><strong>{example.title}</strong><small>{example.focus}</small><b>载入示例</b>
              </button>
            ))}
          </div>
          {loadedExampleId ? <p className="example-loaded-message" role="status">示例已载入，可以直接修改并开始分析。</p> : null}
        </div>
      </details>

      <dialog className="confirm-dialog" ref={confirmRef}>
        <form method="dialog">
          <span className="eyebrow">分析前确认</span>
          <h2>确认发送当前文本？</h2>
          <p>将发送：{textLength.toLocaleString()} 个字符、任务类型、章节类型、写作语境和 {draft.terminologyLocks.length} 条术语规则。不会发送原始 DOCX。</p>
          <div className="responsibility-note"><strong>作者必须核对</strong><span>数值、单位、事实、方法、引用、因果关系和结论强度仍由作者负责。</span></div>
          <div className="dialog-actions"><button value="cancel">返回检查</button><button className="primary-button" onClick={onAnalyze} value="confirm">确认并开始分析</button></div>
        </form>
      </dialog>
    </div>
  );
}
