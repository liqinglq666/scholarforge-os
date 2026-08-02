'use client';

import { useEffect, useState } from 'react';
import { TaskSetup } from '@/components/task-setup/task-setup';
import { ReviewWorkbench } from '@/components/review/review-workbench';
import { StatusBanner } from '@/components/feedback/status-banner';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { MAX_HISTORY_ENTRIES } from '@/lib/config';
import type { ApiErrorPayload, ReviewResult, ReviewServiceStatus, WorkspaceDraft } from '@/lib/types';
import { createDraft, createHistoryEntry, createWorkspaceState } from '@/lib/workspace/schema';

type AnalysisStage = 'preparing' | 'reviewing' | 'organizing';

const STAGE_LABELS: Record<AnalysisStage, { title: string; description: string }> = {
  preparing: { title: '正在准备请求', description: '校验正文长度、任务设置和术语锁。' },
  reviewing: { title: '正在进行专业检查', description: '模型正在生成建议；这一步可能需要几十秒。' },
  organizing: { title: '正在整理问题', description: '代码正在验证数值、单位、术语锁和问题结构。' },
};

export function WorkspaceApp() {
  const { data, ready, saveState, saveMessage, updateCurrent, replaceData, saveNow } = useWorkspace();
  const [service, setService] = useState<ReviewServiceStatus | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage | null>(null);
  const [pageError, setPageError] = useState('');

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
    const workspace = data.current;
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
      const message = error instanceof Error ? error.message : '分析失败。';
      setPageError(message);
      updateCurrent({ ...workspace, status: 'error', lastError: message });
    } finally {
      setAnalysisStage(null);
    }
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
