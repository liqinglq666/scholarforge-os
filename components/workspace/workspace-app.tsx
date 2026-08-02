'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TaskSetup } from '@/components/task-setup/task-setup';
import { ReviewWorkbench } from '@/components/review/review-workbench';
import { StatusBanner } from '@/components/feedback/status-banner';
import { ProjectToolNav } from '@/components/project/project-tool-nav';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { MAX_HISTORY_ENTRIES, TASK_LABELS } from '@/lib/config';
import { findResearchExample } from '@/lib/examples';
import { compareRevisionTexts } from '@/lib/project/revisions';
import { getProject, upsertProject } from '@/lib/project/workspace';
import type { ApiErrorPayload, ReviewResult, ReviewServiceStatus, TaskType, WorkspaceDraft } from '@/lib/types';
import { createDraft, createDraftFromPreferences, createHistoryEntry, createRevisionComparison, createWorkspaceState } from '@/lib/workspace/schema';

type AnalysisStage = 'preparing' | 'reviewing' | 'organizing';

const STAGE_LABELS: Record<AnalysisStage, { title: string; description: string }> = {
  preparing: { title: '正在准备请求', description: '校验正文长度、任务设置和术语锁。' },
  reviewing: { title: '正在进行专业检查', description: '模型正在生成建议；这一步可能需要几十秒。' },
  organizing: { title: '正在整理问题', description: '代码正在验证数值、单位、术语锁和问题结构。' },
};

const TASK_TYPES = new Set<TaskType>(['translate', 'polish', 'precheck']);
const CLIENT_ANALYSIS_TIMEOUT_MS = 65_000;

export function WorkspaceApp({ projectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const { data, ready, saveState, saveMessage, updateCurrent, replaceData, saveNow } = useWorkspace();
  const [service, setService] = useState<ReviewServiceStatus | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage | null>(null);
  const [pageError, setPageError] = useState('');
  const [projectMessage, setProjectMessage] = useState('');
  const analysisControllerRef = useRef<AbortController | null>(null);
  const entryParamAppliedRef = useRef(false);
  const routeProject = projectId ? getProject(data, projectId) : null;
  const linkedChapter = (() => {
    const project = projectId ? routeProject : getProject(data, data.current.draft.linkedProjectId);
    const draft = data.current.draft;
    if (!project || draft.linkedProjectId !== project.id || !draft.linkedChapterId) return null;
    return project.chapters.find((chapter) => chapter.id === draft.linkedChapterId) || null;
  })();

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
    if (projectId || !ready || entryParamAppliedRef.current) return;
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
        ...data,
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
  }, [data, projectId, ready, replaceData, saveNow, updateCurrent]);

  useEffect(() => () => analysisControllerRef.current?.abort(), []);

  function updateDraft(patch: Partial<WorkspaceDraft>) {
    updateCurrent((current) => ({
      ...current,
      draft: { ...current.draft, ...patch, updatedAt: new Date().toISOString() },
      workingText: patch.sourceText === undefined ? current.workingText : patch.sourceText,
      lastError: undefined,
    }));
    setPageError('');
    setProjectMessage('');
  }

  function saveBackToProject() {
    const project = getProject(data, data.current.draft.linkedProjectId || projectId);
    const chapterId = data.current.draft.linkedChapterId;
    if (!project || data.current.draft.linkedProjectId !== project.id || !chapterId) return;
    const chapter = project.chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      setProjectMessage('关联章节已不存在，无法回写。当前工作台内容仍然保留。');
      return;
    }
    const now = new Date().toISOString();
    const text = data.current.currentResult ? data.current.workingText : data.current.draft.sourceText;
    const changes = chapter.text === text
      ? []
      : compareRevisionTexts(chapter.text, text).map((change) => ({
          ...change,
          source: data.current.currentResult ? 'ai' as const : 'author' as const,
          reason: data.current.currentResult
            ? `作者在“${TASK_LABELS[data.current.draft.taskType]}”流程中确认后保存。`
            : '作者从项目审校页面保存了新文本。',
        }));
    const comparison = changes.length ? createRevisionComparison({
      title: `${chapter.title} · ${TASK_LABELS[data.current.draft.taskType]} · ${new Date(now).toLocaleDateString('zh-CN')}`,
      chapterId,
      baseLabel: '保存前',
      revisedLabel: '作者确认后',
      baseText: chapter.text,
      revisedText: text,
      changes,
      createdAt: now,
      updatedAt: now,
    }) : null;
    const nextProject = {
      ...project,
      activeChapterId: chapterId,
      chapters: project.chapters.map((item) => item.id === chapterId
        ? {
            ...item,
            title: item.title || data.current.draft.projectName,
            sectionType: data.current.draft.sectionType,
            text,
            updatedAt: now,
            lastReviewedAt: data.current.currentResult ? now : item.lastReviewedAt,
          }
        : item),
      revisionComparisons: comparison
        ? [comparison, ...project.revisionComparisons].slice(0, 20)
        : project.revisionComparisons,
      updatedAt: now,
    };
    const nextData = upsertProject(data, nextProject);
    replaceData(nextData);
    saveNow(nextData);
    setProjectMessage(comparison
      ? `已保存回“${chapter.title}”，并自动生成一条版本记录。`
      : `“${chapter.title}”没有文本变化，已更新审校时间。`);
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
      discipline: data.preferences.discipline,
      academicStage: data.preferences.academicStage,
      englishVariant: data.preferences.englishVariant,
      explanationLevel: data.preferences.explanationLevel,
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
        ...data,
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
      ...data,
      current: createWorkspaceState(createDraftFromPreferences(data.preferences)),
      history,
      updatedAt: new Date().toISOString(),
    };
    replaceData(nextData);
    saveNow(nextData);
    setPageError('');
    setProjectMessage('');
    if (projectId) router.push(`/projects/${projectId}`);
  }

  if (!ready) {
    return <main className="shell page-main"><div className="loading-state" role="status"><span className="spinner" /><strong>正在恢复本地工作区</strong><p>不会上传任何文本。</p></div></main>;
  }


  if (projectId && !routeProject) {
    return (
      <main className="shell page-main workspace-main">
        <ProjectToolNav projectId={projectId} />
        <div className="project-empty compact-empty">
          <span className="eyebrow">项目不存在或已删除</span>
          <h1>无法打开这个项目的审校</h1>
          <p>当前链接指向的项目不在此浏览器中。返回项目列表选择可用项目。</p>
          <Link className="primary-link" href="/projects">查看我的项目</Link>
        </div>
      </main>
    );
  }

  if (projectId && data.current.draft.linkedProjectId !== projectId) {
    return (
      <main className="shell page-main workspace-main">
        <ProjectToolNav projectId={projectId} />
        <div className="project-empty compact-empty">
          <span className="eyebrow">当前项目 · 审校</span>
          <h1>先从章节中选择本次处理内容</h1>
          <p>任务类型属于一次审校操作，而不是章节的永久属性。返回章节列表，选择章节和本次要完成的任务。</p>
          <Link className="primary-link" href={`/projects/${projectId}`}>选择项目章节</Link>
        </div>
      </main>
    );
  }

  if (analysisStage) {
    return (
      <main className="shell page-main workspace-main">
        {projectId ? <ProjectToolNav projectId={projectId} /> : null}
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
      {projectId ? <ProjectToolNav projectId={projectId} /> : null}
      <div className={`save-indicator save-${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveMessage}</div>
      {linkedChapter ? (
        <div className="linked-project-banner">
          <div><strong>来自论文项目：{linkedChapter.title}</strong><span>工作台修改不会自动覆盖项目章节。完成核对后请明确保存回项目。</span></div>
          <div className="linked-project-actions"><Link className="secondary-link" href={`/projects/${data.current.draft.linkedProjectId}`}>返回项目</Link><button className="primary-button" onClick={saveBackToProject} type="button">保存当前文本回项目</button></div>
        </div>
      ) : null}
      {projectMessage ? <StatusBanner tone="success" title="论文项目已更新">{projectMessage}</StatusBanner> : null}
      {pageError ? <StatusBanner tone="danger" title="分析未完成">{pageError} 原文和任务设置仍保存在此浏览器中，请检查服务状态、缩短输入或稍后重试。</StatusBanner> : null}
      {data.current.currentResult
        ? <ReviewWorkbench onStartNew={startNew} onUpdate={updateCurrent} workspace={data.current} />
        : <TaskSetup analyzing={data.current.status === 'analyzing'} draft={data.current.draft} onAnalyze={() => void analyze()} onChange={updateDraft} service={service} serviceLoading={serviceLoading} />}
    </main>
  );
}
