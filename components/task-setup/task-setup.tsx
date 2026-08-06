'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  MAX_SOURCE_CHARACTERS,
  MIN_SOURCE_CHARACTERS,
  SECTION_OPTIONS,
  TASK_DESCRIPTIONS,
  TASK_LABELS,
} from '@/lib/config';
import {
  findResearchExample,
  findResearchExampleForSource,
  getPrimaryResearchExample,
  type ResearchExample,
} from '@/lib/examples';
import { extractDocx, type DocxImportResult } from '@/lib/documents/docx';
import type { ImportedDocument, ReviewServiceStatus, TaskType, TerminologyLock, WorkspaceDraft } from '@/lib/types';
import { StatusBanner } from '@/components/feedback/status-banner';

const TASKS = Object.keys(TASK_LABELS) as TaskType[];
const TASK_EXAMPLES = TASKS
  .map((task) => getPrimaryResearchExample(task))
  .filter((example): example is ResearchExample => example !== null);
const SOURCE_MODE_STORAGE_PREFIX = 'scholarforge.source-mode.v1.';

type InputMode = 'paste' | 'docx';
type SourceOrigin = 'example' | 'custom' | 'docx';

interface SourceState {
  origin: SourceOrigin;
  activeExampleId?: string;
}

interface VolatileSourceState {
  draftId: string;
  value: SourceState;
}

interface DraftSnapshot {
  patch: Partial<WorkspaceDraft>;
  sourceState: SourceState;
}

const TASK_SUMMARIES: Record<TaskType, string> = {
  translate: '中文转为可核对的学术英文，保护数值与固定术语。',
  polish: '改善英文表达，但不新增事实或扩大结论。',
  precheck: '识别语言、方法报告和证据边界问题。',
};

function createExamplePatch(example: ResearchExample): Partial<WorkspaceDraft> {
  return {
    projectName: example.projectName,
    taskType: example.taskType,
    sectionType: example.sectionType,
    targetJournal: example.targetJournal,
    sourceText: example.sourceText,
    terminologyLocks: example.terminologyLocks.map((term) => ({ ...term })),
    importedDocument: undefined,
  };
}

function sourceStateKey(draftId: string) {
  return `${SOURCE_MODE_STORAGE_PREFIX}${draftId}`;
}

function inferSourceState(draft: WorkspaceDraft): SourceState {
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(window.localStorage.getItem(sourceStateKey(draft.id)) || 'null') as Partial<SourceState> | null;
      if (stored?.origin === 'custom') return { origin: 'custom' };
      if (stored?.origin === 'docx' && draft.importedDocument) return { origin: 'docx' };
      if (stored?.origin === 'example' && typeof stored.activeExampleId === 'string') {
        const example = findResearchExample(stored.activeExampleId);
        if (example && example.sourceText === draft.sourceText) {
          return { origin: 'example', activeExampleId: example.id };
        }
      }
    } catch {
      // Invalid UI-only state is ignored; the persisted manuscript remains intact.
    }
  }

  if (draft.importedDocument) return { origin: 'docx' };
  const matchingExample = findResearchExampleForSource(draft.sourceText);
  return matchingExample
    ? { origin: 'example', activeExampleId: matchingExample.id }
    : { origin: 'custom' };
}

function copyImportedDocument(value: ImportedDocument | undefined) {
  return value ? { ...value, warnings: [...value.warnings] } : undefined;
}

function runOnNextFrame(callback: () => void) {
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback);
    return;
  }
  window.setTimeout(callback, 0);
}

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
  const sourceTextRef = useRef<HTMLTextAreaElement>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [importResult, setImportResult] = useState<DocxImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [termSource, setTermSource] = useState('');
  const [termPreferred, setTermPreferred] = useState('');
  const [volatileSourceState, setVolatileSourceState] = useState<VolatileSourceState | null>(null);
  const [switchUndo, setSwitchUndo] = useState<DraftSnapshot | null>(null);
  const [taskNotice, setTaskNotice] = useState('');
  const [editorPulse, setEditorPulse] = useState(false);

  const sourceState = volatileSourceState?.draftId === draft.id
    ? volatileSourceState.value
    : inferSourceState(draft);
  const textLength = draft.sourceText.length;
  const inputValid = textLength >= MIN_SOURCE_CHARACTERS && textLength <= MAX_SOURCE_CHARACTERS;
  const canAnalyze = Boolean(service?.configured && inputValid && !analyzing);
  const lengthPercent = Math.min(100, Math.max(0, (textLength / MAX_SOURCE_CHARACTERS) * 100));
  const activeExample = sourceState.origin === 'example'
    ? findResearchExample(sourceState.activeExampleId)
    : null;
  const currentTaskExample = getPrimaryResearchExample(draft.taskType);
  const sourceModeLabel = sourceState.origin === 'example'
    ? '公开合成示例'
    : sourceState.origin === 'docx'
      ? 'DOCX 导入'
      : '我的文本';
  const disabledReason = serviceLoading
    ? '正在确认分析服务状态…'
    : !service?.configured
      ? '分析服务未配置。文本仍会保存在此浏览器。'
      : textLength < MIN_SOURCE_CHARACTERS
        ? `还需要 ${MIN_SOURCE_CHARACTERS - textLength} 个字符。`
        : textLength > MAX_SOURCE_CHARACTERS
          ? `超出 ${textLength - MAX_SOURCE_CHARACTERS} 个字符，请缩短正文。`
          : '';

  useEffect(() => () => {
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
  }, []);

  function persistSourceState(next: SourceState) {
    setVolatileSourceState({ draftId: draft.id, value: next });
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(sourceStateKey(draft.id), JSON.stringify(next));
    } catch {
      // The volatile state still protects the current manuscript when storage is unavailable.
    }
  }

  function snapshotDraft(): DraftSnapshot {
    return {
      patch: {
        projectName: draft.projectName,
        taskType: draft.taskType,
        sectionType: draft.sectionType,
        targetJournal: draft.targetJournal,
        sourceText: draft.sourceText,
        terminologyLocks: draft.terminologyLocks.map((term) => ({ ...term })),
        importedDocument: copyImportedDocument(draft.importedDocument),
      },
      sourceState,
    };
  }

  function pulseSourceEditor() {
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    setEditorPulse(false);
    runOnNextFrame(() => {
      setEditorPulse(true);
      pulseTimerRef.current = window.setTimeout(() => setEditorPulse(false), 900);
      if (sourceTextRef.current) {
        sourceTextRef.current.scrollTop = 0;
        sourceTextRef.current.setSelectionRange(0, 0);
      }
    });
  }

  function markAuthoredChange(patch: Partial<WorkspaceDraft>, textEdited = false) {
    onChange(patch);
    const leavesExampleMode = sourceState.origin === 'example';
    const leavesDocxMode = textEdited && sourceState.origin === 'docx';
    if (leavesExampleMode || leavesDocxMode) {
      persistSourceState({ origin: 'custom' });
      setTaskNotice('已进入“我的文本”模式。之后切换任务不会覆盖当前内容。');
    }
    setSwitchUndo(null);
  }

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
    persistSourceState({ origin: 'docx' });
    setSwitchUndo(null);
    setTaskNotice(`已从 ${importResult.fileName} 载入“${section.title}”。切换任务不会覆盖这段正文。`);
    setImportResult(null);
    setInputMode('paste');
    pulseSourceEditor();
  }

  function applyExample(example: ResearchExample, notice: string) {
    setSwitchUndo(snapshotDraft());
    onChange(createExamplePatch(example));
    persistSourceState({ origin: 'example', activeExampleId: example.id });
    setImportResult(null);
    setImportError('');
    setInputMode('paste');
    setTaskNotice(notice);
    pulseSourceEditor();
  }

  function loadExample(example: ResearchExample) {
    if (sourceState.origin !== 'example' && draft.sourceText.trim() && !window.confirm('载入示例会替换当前输入文本和设置。确定继续吗？')) return;
    applyExample(example, `已载入“${TASK_LABELS[example.taskType]}”公开合成示例。`);
  }

  function loadCurrentTaskExample() {
    if (!currentTaskExample) return;
    loadExample(currentTaskExample);
  }

  function selectTask(task: TaskType) {
    if (task === draft.taskType) return;
    const nextExample = getPrimaryResearchExample(task);

    if (sourceState.origin === 'example' && nextExample) {
      applyExample(nextExample, `已切换为“${TASK_LABELS[task]}”示例；正文、任务名称、期刊和术语规则已同步更新。`);
      return;
    }

    onChange({ taskType: task });
    setSwitchUndo(null);
    setTaskNotice(`任务已切换为“${TASK_LABELS[task]}”，当前${sourceModeLabel}已保留。可使用“载入当前任务示例”主动替换。`);
  }

  function clearForCustomText() {
    if (draft.sourceText.trim() && !window.confirm('这会清空当前示例正文和示例设置，进入“我的文本”模式。确定继续吗？')) return;
    setSwitchUndo(snapshotDraft());
    onChange({
      projectName: '',
      sectionType: 'general',
      targetJournal: '',
      sourceText: '',
      terminologyLocks: [],
      importedDocument: undefined,
    });
    persistSourceState({ origin: 'custom' });
    setTaskNotice('已进入“我的文本”模式。请粘贴论文正文，切换任务时内容会保持不变。');
    setInputMode('paste');
    runOnNextFrame(() => sourceTextRef.current?.focus());
  }

  function undoSourceSwitch() {
    if (!switchUndo) return;
    onChange(switchUndo.patch);
    persistSourceState(switchUndo.sourceState);
    setSwitchUndo(null);
    setTaskNotice('已恢复切换前的正文和任务设置。');
    setInputMode('paste');
    pulseSourceEditor();
  }

  function addTerm() {
    const source = termSource.trim();
    const preferred = termPreferred.trim();
    if (!source || !preferred || draft.terminologyLocks.length >= 20) return;
    const next: TerminologyLock = { id: crypto.randomUUID(), source, preferred };
    markAuthoredChange({ terminologyLocks: [...draft.terminologyLocks, next] });
    setTermSource('');
    setTermPreferred('');
  }

  return (
    <div className="workspace-setup quick-review-setup">
      <nav aria-label="审校流程" className="workspace-stage-bar">
        <span className="active"><b>1</b>输入</span>
        <span><b>2</b>分析</span>
        <span><b>3</b>核对</span>
        <span><b>4</b>修改</span>
        <span><b>5</b>导出</span>
      </nav>

      <div className="workspace-titlebar">
        <div><span className="product-label">快速审校</span><h1>准备本次审校任务</h1></div>
        <p>先确认任务与正文来源。正文默认保存在当前浏览器，只有确认开始分析后才会发送到模型服务。</p>
      </div>

      {!serviceLoading && service && !service.configured ? (
        <StatusBanner tone="warning" title="分析服务未配置">{service.message}</StatusBanner>
      ) : null}

      {taskNotice ? (
        <div className="task-switch-notice" role="status" aria-live="polite">
          <span>{taskNotice}</span>
          {switchUndo ? <button onClick={undoSourceSwitch} type="button">撤销切换</button> : null}
        </div>
      ) : null}

      <div className="setup-editor-grid">
        <section aria-labelledby="source-editor-title" className={`source-editor-panel quick-review-panel${editorPulse ? ' example-transition' : ''}`}>
          <header>
            <div><span className="setup-step">输入内容</span><h2 id="source-editor-title">论文文本</h2></div>
            <div className="source-panel-actions">
              {draft.importedDocument ? <span className="imported-file-label">来自 {draft.importedDocument.fileName}</span> : null}
              <span className={`source-origin-badge origin-${sourceState.origin}`}>{sourceModeLabel}</span>
              {sourceState.origin === 'example'
                ? <button onClick={clearForCustomText} type="button">清空并输入我的文本</button>
                : <button disabled={!currentTaskExample} onClick={loadCurrentTaskExample} type="button">载入当前任务示例</button>}
            </div>
          </header>

          <div aria-label="输入方式" className="input-mode-tabs" role="tablist">
            <button aria-controls="paste-input-panel" aria-selected={inputMode === 'paste'} id="paste-input-tab" onClick={() => setInputMode('paste')} role="tab" type="button">粘贴文本</button>
            <button aria-controls="docx-input-panel" aria-selected={inputMode === 'docx'} id="docx-input-tab" onClick={() => setInputMode('docx')} role="tab" type="button">导入 DOCX</button>
          </div>

          {inputMode === 'paste' ? (
            <div aria-labelledby="paste-input-tab" className="paste-input-panel" id="paste-input-panel" role="tabpanel">
              <label className="source-field quick-source" htmlFor="source-text">
                <span>{draft.taskType === 'translate' ? '中文科研原文' : '英文论文原文'}</span>
                <textarea
                  aria-describedby="character-status"
                  id="source-text"
                  onChange={(event) => markAuthoredChange({ sourceText: event.target.value, importedDocument: undefined }, true)}
                  placeholder={draft.taskType === 'translate' ? '粘贴需要翻译的摘要、方法、结果或讨论段落…' : 'Paste the manuscript passage that needs careful review…'}
                  ref={sourceTextRef}
                  spellCheck={draft.taskType !== 'translate'}
                  value={draft.sourceText}
                />
              </label>
              <div className="character-meter" id="character-status">
                <div><span>{textLength < MIN_SOURCE_CHARACTERS ? `至少需要 ${MIN_SOURCE_CHARACTERS} 个字符` : textLength > MAX_SOURCE_CHARACTERS ? '内容超过限制' : '长度符合要求'}</span><strong>{textLength.toLocaleString()} / {MAX_SOURCE_CHARACTERS.toLocaleString()}</strong></div>
                <span aria-hidden="true"><i style={{ width: `${lengthPercent}%` }} /></span>
              </div>

              <section className="inline-example-switcher" aria-labelledby="inline-example-title">
                <div>
                  <span className="setup-step">同一研究主题</span>
                  <h3 id="inline-example-title">比较三种任务的处理边界</h3>
                  <p>公开合成示例不会自动调用模型。选择后可直接修改，首次编辑即进入“我的文本”模式。</p>
                </div>
                <div className="inline-example-list">
                  {TASK_EXAMPLES.map((example) => (
                    <button
                      aria-label={`使用示例：${TASK_LABELS[example.taskType]}，${example.title}`}
                      className={activeExample?.id === example.id ? 'selected' : ''}
                      disabled={activeExample?.id === example.id}
                      key={example.id}
                      onClick={() => loadExample(example)}
                      type="button"
                    >
                      <span>{TASK_LABELS[example.taskType]}</span>
                      <strong>{example.title}</strong>
                      <small>{example.focus}</small>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div aria-labelledby="docx-input-tab" className="docx-input-panel" id="docx-input-panel" role="tabpanel">
              <label className="docx-dropzone">
                <input accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} type="file" />
                <span aria-hidden="true">DOCX</span>
                <strong>{importing ? '正在提取正文…' : '选择一个 DOCX 文件'}</strong>
                <p>文件仅在浏览器中解析，原始二进制不会上传。单个文件最大 8 MB。</p>
              </label>
              {importError ? <p className="field-error" role="alert">{importError}</p> : null}
              {importResult ? (
                <div className="import-preview" aria-live="polite">
                  <div><strong>{importResult.fileName}</strong><button onClick={() => setImportResult(null)} type="button">取消</button></div>
                  <p>已识别以下章节，选择一个章节载入编辑器。</p>
                  <div className="section-list">{importResult.sections.map((section, index) => <button key={section.id} onClick={() => selectSection(index)} type="button"><span><b>{section.title}</b><small>{section.characterCount.toLocaleString()} 字符</small></span><span>使用本章节</span></button>)}</div>
                  {importResult.warnings.length ? <ul>{importResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="task-settings-panel" aria-labelledby="task-settings-title">
          <header><span className="setup-step">任务设置</span><h2 id="task-settings-title">本次要完成什么？</h2></header>
          <div className="task-choice-list quick-task-switcher" role="radiogroup" aria-label="任务类型">
            {TASKS.map((task) => (
              <label className={draft.taskType === task ? 'selected' : ''} key={task}>
                <input checked={draft.taskType === task} name="taskType" onChange={() => selectTask(task)} type="radio" />
                <span aria-hidden="true" />
                <div><strong>{TASK_LABELS[task]}</strong><small>{TASK_SUMMARIES[task]}</small></div>
              </label>
            ))}
          </div>
          <div className="task-selection-detail">
            <span>当前任务边界</span>
            <p>{TASK_DESCRIPTIONS[draft.taskType]}</p>
          </div>

          <div className="task-context-fields">
            <label><span>章节类型</span><select onChange={(event) => markAuthoredChange({ sectionType: event.target.value as WorkspaceDraft['sectionType'] })} value={draft.sectionType}>{SECTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>任务名称（可选）</span><input maxLength={120} onChange={(event) => markAuthoredChange({ projectName: event.target.value })} placeholder="例如：Discussion 段落审校" value={draft.projectName} /></label>
            <label><span>目标期刊或语境（可选）</span><input maxLength={160} onChange={(event) => markAuthoredChange({ targetJournal: event.target.value })} placeholder="例如：Nature Communications" value={draft.targetJournal} /></label>
          </div>

          <details className="compact-settings-details">
            <summary><span>术语规则</span><b>{draft.terminologyLocks.length} / 20</b></summary>
            <div className="compact-settings-content">
              <p>锁定材料名、量表、算法、缩写或固定译法。</p>
              <div className="term-entry">
                <label><span>原词</span><input maxLength={120} onChange={(event) => setTermSource(event.target.value)} value={termSource} /></label>
                <label><span>指定表达</span><input maxLength={160} onChange={(event) => setTermPreferred(event.target.value)} value={termPreferred} /></label>
                <button disabled={!termSource.trim() || !termPreferred.trim() || draft.terminologyLocks.length >= 20} onClick={addTerm} type="button">添加规则</button>
              </div>
              {draft.terminologyLocks.length ? <ul className="term-list">{draft.terminologyLocks.map((term) => <li key={term.id}><span><b>{term.source}</b><small>{term.preferred}</small></span><button aria-label={`删除术语 ${term.source}`} onClick={() => markAuthoredChange({ terminologyLocks: draft.terminologyLocks.filter((item) => item.id !== term.id) })} type="button">删除</button></li>)}</ul> : <p className="empty-inline">当前没有额外术语规则。</p>}
            </div>
          </details>

          <div className="analysis-commitment quick-review-submit">
            <div><strong>分析前状态</strong><span>{disabledReason || `将发送 ${textLength.toLocaleString()} 个字符和 ${draft.terminologyLocks.length} 条术语规则。`}</span></div>
            <button className="primary-button" disabled={!canAnalyze} onClick={() => confirmRef.current?.showModal()} type="button">检查并开始分析</button>
          </div>
        </aside>
      </div>

      <dialog className="confirm-dialog" ref={confirmRef}>
        <form method="dialog">
          <span className="product-label">分析前确认</span>
          <h2>确认发送当前文本？</h2>
          <p>本次将发送 {textLength.toLocaleString()} 个字符、任务类型、章节类型、写作语境和 {draft.terminologyLocks.length} 条术语规则。原始 DOCX 不会发送。</p>
          <div className="confirmation-list">
            <span><b>文本</b>{textLength.toLocaleString()} 个字符</span>
            <span><b>任务</b>{TASK_LABELS[draft.taskType]}</span>
            <span><b>来源</b>{sourceModeLabel}</span>
            <span><b>章节</b>{SECTION_OPTIONS.find(([value]) => value === draft.sectionType)?.[1] || draft.sectionType}</span>
          </div>
          <div className="responsibility-note"><strong>仍需作者核对</strong><span>事实、数值、单位、方法、引用、因果关系和结论强度。</span></div>
          <div className="dialog-actions"><button value="cancel">返回检查</button><button className="primary-button" onClick={onAnalyze} value="confirm">确认并开始分析</button></div>
        </form>
      </dialog>
    </div>
  );
}
