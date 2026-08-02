'use client';

import { useEffect, useRef, useState } from 'react';
import { TaskSetup } from '@/components/task-setup/task-setup';
import { ReviewWorkbench } from '@/components/review/review-workbench';
import { StatusBanner } from '@/components/feedback/status-banner';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { MAX_HISTORY_ENTRIES } from '@/lib/config';
import { findResearchExample } from '@/lib/examples';
import type { ApiErrorPayload, ReviewResult, ReviewServiceStatus, TaskType, WorkspaceDraft } from '@/lib/types';
import { createDraft, createHistoryEntry, createWorkspaceState } from '@/lib/workspace/schema';

type AnalysisStage = 'preparing' | 'reviewing' | 'organizing';

const STAGE_LABELS: Record<AnalysisStage, { title: string; description: string }> = {
  preparing: { title: '正在准备请求', description: '校验正文长度、任务设置和术语锁。' },
  reviewing: { title: '正在进行专业检查', description: '模型正在生成建议；这一步可能需要几十秒。' },
  organizing: { title: '正在整理问题', description: '代码正在验证数值、单位、术语锁和问题结构。' },
};

const TASK_TYPES = new Set<TaskType>(['translate', 'polish', 'precheck']);
const CLIENT_ANALYSIS_TIMEOUT_MS = 65_000;

export function WorkspaceApp() {
  const { data, ready, saveState, saveMessage, updateCurrent, replaceData, saveNow } = useWorkspace();
  const [service, setService] = useState<ReviewServiceStatus | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage | null>(null);
  const [pageError, setPageError] = useState('');
  const analysisControllerRef = useRef<AbortController | null>(null);
  const entryParamAppliedRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch('/api/health', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('无法确认分析服务状态。');
        return response.json() as Promise<ReviewServiceStatus>;
      })
      .then((value) => { if (active) setService(value); })
      .catch(() => {
        if (active) setService({
          configured: false,
          model: null,
          message: '暂时无法确认服务状态。为了保护正文，分析按钮已禁用；本地编辑和导出仍可使用。',
          limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 6, windowMinutes: 10 },
        });
      })
      .finally(() => { if (active) setServiceLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || entryParamAppliedRef.current) return;
    entryParamAppliedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedExample = findResearchExample(params.get('example'));
    const requestedTask = params.get('task') as TaskType | null;

    if (requestedExample) {
      const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
      if (hasCurrentWork && !window.confirm('载入示例会开始一个新任务。当前草稿或分析结果会先保存到最近任务。确定继续吗？')) {
        window.history.replaceState(null, '', '/workspace');
        return;
      }
      const preservedCurrent = hasCurrentWork ? createHistoryEntry(data.current) : null;
      const history = [
        ...(preservedCurrent ? [preservedCurrent] : []),
        ...data.history.filter((item) => item.id !== preservedCurrent?.id),
      ].slice(0, MAX_HISTORY_ENTRIES);
      const draft = createDraft({
        projectName: requestedExample.projectName,
        taskType: requestedExample.taskType,
        sectionType: requestedExample.sectionType,
        targetJournal: requestedExample.targetJournal,
        sourceText: requestedExample.sourceText,
        terminologyLocks: requestedExample.terminologyLocks.map((term) => ({ ...term })),
      });
      const nextData = {
        version: 2 as const,
        current: createWorkspaceState(draft),
        history,
        updatedAt: new Date().toISOString(),
      };
      replaceData(nextData);
      saveNow(nextData);
      window.history.replaceState(null, '', '/workspace');
      return;
    }

    if (requestedTask && TASK_TYPES.has(requestedTask) && !data.current.currentResult && !data.current.draft.sourceText.trim()) {
      updateCurrent((current) => ({
        ...current,
        draft: { ...current.draft, taskType: requestedTask, updatedAt: new Date().toISOString() },
      }));
    }
    if (requestedTask) window.history.replaceState(null, '', '/workspace');
  }, [data, ready, replaceData, saveNow, updateCurrent]);

  useEffect(() => () => analysisControllerRef.current?.abort(), []);

  function updateDraft(patch: Partial<WorkspaceDraft>) {
    updateCurrent((current) => ({
      ...current,
      draft: { ...current.draft, ...patch, updatedAt: new Date().toISOString() },
      workingText: patch.sourceText === undefined ? current.workingText : patch.sourceText,
      lastError: undefined,
    }));
    setPageError('');
  }

  async function analyze() {
    if (analysisControllerRef.current) return;
    const workspace = data.current;
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_ANALYSIS_TIMEOUT_MS);

    setPageError('');
    setAnalysisStage('preparing');
    updateCurrent({ ...workspace, status: 'analyzing', lastError: undefined });

    const requestBody = {
      taskId: workspace.draft.id,
      projectName: workspace.draft.projectName,
      taskType: workspace.draft.taskType,
      sectionType: workspace.draft.sectionType,
      targetJournal: workspace.draft.targetJournal,
      text: workspace.draft.sourceText,
      terminologyLocks: workspace.draft.terminologyLocks,
    };

    try {
      setAnalysisStage('reviewing');
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ScholarForge-Session': workspace.draft.id },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      setAnalysisStage('organizing');
      const payload = await response.json() as { result?: ReviewResult } & Partial<ApiErrorPayload>;
      if (!response.ok || !payload.result) throw new Error(payload.error || '分析没有返回有效结果。');
      if (payload.result.taskId !== workspace.draft.id) throw new Error('分析结果与当前任务不匹配，已拒绝加载。');

      const decisions = Object.fromEntries(payload.result.issues.map((issue) => [issue.id, 'pending' as const]));
      const completed = {
        ...workspace,
        currentResult: payload.result,
        decisions,
        appliedEdits: [],
        undoStack: [],
        redoStack: [],
        workingText: workspace.draft.sourceText,
        status: 'reviewing' as const,
        lastError: undefined,
      };
      const entry = createHistoryEntry(completed);
      const nextData = {
        version: 2 as const,
        current: completed,
        history: [entry, ...data.history.filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES),
        updatedAt: new Date().toISOString(),
      };
      replaceData(nextData);
      saveNow(nextData);
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      const message = aborted
        ? timedOut
          ? '分析等待超过 65 秒，已在浏览器端停止等待。原文和设置仍保存在此浏览器中。'
          : '分析已取消。原文和设置仍保存在此浏览器中。'
        : error instanceof Error ? error.message : '分析失败。';
      setPageError(message);
      updateCurrent((current) => ({ ...current, status: current.currentResult ? 'reviewing' : 'draft', lastError: message }));
    } finally {
      window.clearTimeout(timeout);
      analysisControllerRef.current = null;
      setAnalysisStage(null);
    }
  }

  function cancelAnalysis() {
    analysisControllerRef.current?.abort();
  }

  function startNew() {
    if (!window.confirm('开始新任务会把当前结果保留在“最近任务”，并清空当前输入。确定继续吗？')) return;
    const entry = data.current.currentResult ? createHistoryEntry(data.current) : null;
    const history = entry
      ? [entry, ...data.history.filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES)
      : data.history;
    const nextData = {
      version: 2 as const,
      current: createWorkspaceState(createDraft()),
      history,
      updatedAt: new Date().toISOString(),
    };
    replaceData(nextData);
    saveNow(nextData);
    setPageError('');
  }

  if (!ready) {
    return <main className="shell page-main"><div className="loading-state" role="status"><span className="spinner" /><strong>正在恢复本地工作区</strong><p>不会上传任何文本。</p></div></main>;
  }

  if (analysisStage) {
    return (
      <main className="shell page-main">
        <div className="analysis-state" aria-live="polite">
          <span className="spinner large" />
          <span className="eyebrow">分析进行中</span>
          <h1>{STAGE_LABELS[analysisStage].title}</h1>
          <p>{STAGE_LABELS[analysisStage].description}</p>
          <div className="stage-list">
            {(['preparing', 'reviewing', 'organizing'] as AnalysisStage[]).map((stage) => <span className={stage === analysisStage ? 'current' : ''} key={stage}>{STAGE_LABELS[stage].title}</span>)}
          </div>
          <small>请保持页面打开。若请求失败，原文和设置仍保存在此浏览器中。</small>
          <button className="secondary-button" onClick={cancelAnalysis} type="button">取消分析</button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell page-main workspace-main">
      <div className={`save-indicator save-${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveMessage}</div>
      {pageError ? <StatusBanner tone="danger" title="分析未完成">{pageError} 原文和任务设置仍保存在此浏览器中，请检查服务状态、缩短输入或稍后重试。</StatusBanner> : null}
      {data.current.currentResult
        ? <ReviewWorkbench onStartNew={startNew} onUpdate={updateCurrent} workspace={data.current} />
        : <TaskSetup analyzing={data.current.status === 'analyzing'} draft={data.current.draft} onAnalyze={() => void analyze()} onChange={updateDraft} service={service} serviceLoading={serviceLoading} />}
    </main>
  );
}
