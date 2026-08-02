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
      ? '分析服务未配置。你仍可编辑、保存和导出工作区。'
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
    if (draft.sourceText.trim() && !window.confirm('载入示例会替换当前输入文本和任务设置。未分析草稿不会进入最近任务，建议先复制文本或导出备份。确定继续吗？')) return;
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
    <div className="workspace-setup">
      <div className="page-heading compact">
        <div><span className="eyebrow">新任务 · 第 1 步，共 2 步</span><h1>准备需要核对的科研文本</h1></div>
        <p>原始文件在浏览器中解析。只有点击“确认并开始分析”后，下方正文、任务设置和术语锁才会发送给模型。</p>
      </div>

      {!serviceLoading && service ? (
        <StatusBanner tone={service.configured ? 'success' : 'warning'} title={service.configured ? '分析服务已配置' : '分析服务未配置'}>
          {service.message}
        </StatusBanner>
      ) : null}

      <section aria-labelledby="task-type-title" className="panel task-picker">
        <div className="panel-heading"><div><span className="step-number">01</span><h2 id="task-type-title">选择任务</h2></div><p>每次只解决一个明确问题。</p></div>
        <div className="task-grid" role="radiogroup" aria-label="任务类型">
          {TASKS.map((task) => (
            <label className={draft.taskType === task ? 'task-option selected' : 'task-option'} key={task}>
              <input checked={draft.taskType === task} name="taskType" onChange={() => onChange({ taskType: task })} type="radio" />
              <span aria-hidden="true" className="radio-mark" />
              <b>{TASK_LABELS[task]}</b>
              <small>{TASK_DESCRIPTIONS[task]}</small>
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="example-library-title" className="panel workspace-example-library">
        <header>
          <div><span className="eyebrow">可选</span><h2 id="example-library-title">用跨学科示例体验完整流程</h2></div>
          <p>示例只会填入本地草稿，不会自动发送给模型。</p>
        </header>
        <div className="workspace-example-grid">
          {RESEARCH_EXAMPLES.map((example) => (
            <button
              aria-label={`使用示例：${example.discipline}，${example.title}`}
              className="workspace-example-card"
              key={example.id}
              onClick={() => loadExample(example)}
              type="button"
            >
              <span>{example.discipline} · {TASK_LABELS[example.taskType]}</span>
              <strong>{example.title}</strong>
              <small>{example.focus}</small>
              <b>载入此示例</b>
            </button>
          ))}
        </div>
        {loadedExampleId ? <p className="example-loaded-message" role="status">示例已载入。你可以直接修改文本和设置，再决定是否开始分析。</p> : null}
      </section>

      <section aria-labelledby="source-title" className="panel input-panel">
        <div className="panel-heading"><div><span className="step-number">02</span><h2 id="source-title">输入材料</h2></div><p>支持粘贴文本或提取 DOCX 正文。</p></div>
        <div className="form-grid two-columns">
          <label><span>项目名称</span><input maxLength={120} onChange={(event) => onChange({ projectName: event.target.value })} placeholder="例如：硕士论文 · Methods" value={draft.projectName} /></label>
          <label><span>章节类型</span><select onChange={(event) => onChange({ sectionType: event.target.value as WorkspaceDraft['sectionType'] })} value={draft.sectionType}>{SECTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="full-width"><span>目标期刊（可选，仅作写作语境，不验证期刊规则）</span><input maxLength={160} onChange={(event) => onChange({ targetJournal: event.target.value })} placeholder="例如：你的目标期刊名称" value={draft.targetJournal} /></label>
        </div>

        <div className="source-toolbar">
          <label className="file-button">
            <input accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} type="file" />
            {importing ? '正在提取正文…' : '导入 DOCX'}
          </label>
          <span>不上传原始 DOCX · 最大 8 MB · 不保留公式、表格结构和页面样式</span>
        </div>
        {importError ? <p className="field-error" role="alert">{importError}</p> : null}

        {importResult ? (
          <div className="import-preview" aria-live="polite">
            <div><strong>已在浏览器中提取：{importResult.fileName}</strong><button onClick={() => setImportResult(null)} type="button">取消导入</button></div>
            <p>
              请选择一个章节进入当前任务；导入不会覆盖你已选择的任务。
              {importResult.suggestedTask !== draft.taskType ? (
                <> 系统根据文本语言建议“{TASK_LABELS[importResult.suggestedTask]}”。<button onClick={() => onChange({ taskType: importResult.suggestedTask })} type="button">采用建议</button></>
              ) : null}
            </p>
            <div className="section-list">
              {importResult.sections.map((section, index) => (
                <button key={section.id} onClick={() => selectSection(index)} type="button">
                  <span><b>{section.title}</b><small>{section.characterCount.toLocaleString()} 字符</small></span><span>使用本章节</span>
                </button>
              ))}
            </div>
            <ul>{importResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>
        ) : null}

        <label className="source-field" htmlFor="source-text">
          <span>{draft.taskType === 'translate' ? '中文科研原文' : '英文论文原文'}</span>
          <textarea
            aria-describedby="character-status"
            id="source-text"
            onChange={(event) => {
              setLoadedExampleId('');
              onChange({ sourceText: event.target.value, importedDocument: undefined });
            }}
            placeholder={draft.taskType === 'translate' ? '粘贴需要翻译的中文摘要、方法、结果或讨论段落…' : 'Paste the manuscript passage that needs careful review…'}
            spellCheck={draft.taskType !== 'translate'}
            value={draft.sourceText}
          />
        </label>
        <div className={textLength > MAX_SOURCE_CHARACTERS ? 'character-count over' : 'character-count'} id="character-status">
          <span>{textLength < MIN_SOURCE_CHARACTERS ? `至少 ${MIN_SOURCE_CHARACTERS} 个字符` : '长度符合要求'}</span>
          <strong>{textLength.toLocaleString()} / {MAX_SOURCE_CHARACTERS.toLocaleString()}</strong>
        </div>
      </section>

      <section aria-labelledby="terms-title" className="panel terms-panel">
        <div className="panel-heading"><div><span className="step-number">03</span><h2 id="terms-title">术语锁（可选）</h2></div><p>代码会验证建议稿是否使用指定表达。</p></div>
        <div className="term-entry">
          <label><span>原词</span><input maxLength={120} onChange={(event) => setTermSource(event.target.value)} placeholder="例如：学术写作自我效能" value={termSource} /></label>
          <label><span>指定表达</span><input maxLength={160} onChange={(event) => setTermPreferred(event.target.value)} placeholder="例如：academic writing self-efficacy" value={termPreferred} /></label>
          <button disabled={!termSource.trim() || !termPreferred.trim() || draft.terminologyLocks.length >= 20} onClick={addTerm} type="button">添加术语</button>
        </div>
        {draft.terminologyLocks.length ? (
          <ul className="term-list">{draft.terminologyLocks.map((term) => <li key={term.id}><span><b>{term.source}</b><small>必须使用：{term.preferred}</small></span><button aria-label={`删除术语 ${term.source}`} onClick={() => onChange({ terminologyLocks: draft.terminologyLocks.filter((item) => item.id !== term.id) })} type="button">删除</button></li>)}</ul>
        ) : <p className="empty-inline">尚未添加术语锁。常用材料名、缩写、变量名和量表名称适合锁定。</p>}
      </section>

      <div className="analysis-bar">
        <div><strong>{TASK_LABELS[draft.taskType]}</strong><span>{disabledReason || `将发送 ${textLength.toLocaleString()} 个字符及 ${draft.terminologyLocks.length} 条术语锁`}</span></div>
        <button className="primary-button" disabled={!canAnalyze} onClick={() => confirmRef.current?.showModal()} type="button">检查发送内容</button>
      </div>

      <dialog className="confirm-dialog" ref={confirmRef}>
        <form method="dialog">
          <span className="eyebrow">分析前确认</span>
          <h2>确认把所选文本发送给模型？</h2>
          <p>将发送：{textLength.toLocaleString()} 个字符、任务类型、章节类型、目标期刊文本和 {draft.terminologyLocks.length} 条术语锁。不会发送原始 DOCX 文件。</p>
          <div className="responsibility-note"><strong>作者必须核对</strong><span>所有数值、单位、事实、方法、引用、因果关系与结论强度。AI 建议不会自动进入作者工作稿。</span></div>
          <div className="dialog-actions"><button value="cancel">返回检查</button><button className="primary-button" onClick={onAnalyze} value="confirm">确认并开始分析</button></div>
        </form>
      </dialog>
    </div>
  );
}
