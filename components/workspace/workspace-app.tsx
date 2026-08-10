'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TaskSetup } from '@/components/task-setup/task-setup';
import { ReviewWorkbench } from '@/components/review/review-workbench';
import { useReviewServiceStatus } from '@/components/review/use-review-service-status';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { StatusBanner } from '@/components/feedback/status-banner';
import { ProjectToolNav } from '@/components/project/project-tool-nav';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { findResearchExample, type ResearchExample } from '@/lib/examples';
import { getProject, saveWorkspaceBackToProject } from '@/lib/project/workspace';
import {
  createReviewAnalysisRun,
  type AnalysisStage,
  type ReviewAnalysisRun,
} from '@/lib/review/client';
import type { TaskType, WorkspaceDraft } from '@/lib/types';
import { loadResearchExampleWorkspace, startNewTaskWorkspace } from '@/lib/workspace/transitions';

const STAGE_LABELS: Record<AnalysisStage, { title: string; description: string }> = {
  preparing: { title: '正在准备请求', description: '校验正文长度、任务设置和术语锁。' },
  reviewing: { title: '正在进行专业检查', description: '模型正在生成建议；这一步可能需要几十秒。' },
  organizing: { title: '正在整理问题', description: '代码正在验证数值、单位、术语锁和问题结构。' },
};

const TASK_TYPES = new Set<TaskType>(['translate', 'polish', 'precheck']);

export function WorkspaceApp({ projectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const { data, ready, saveState, saveMessage, updateCurrent, replaceData, saveNow } = useWorkspace();
  const { status: service, loading: serviceLoading } = useReviewServiceStatus();
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage | null>(null);
  const [pageError, setPageError] = useState('');
  const [projectMessage, setProjectMessage] = useState('');
  const [newTaskConfirmOpen, setNewTaskConfirmOpen] = useState(false);
  const [pendingEntryExample, setPendingEntryExample] = useState<ResearchExample | null>(null);
  const analysisRunRef = useRef<ReviewAnalysisRun | null>(null);
  const mountedRef = useRef(true);
  const entryParamAppliedRef = useRef(false);
  const routeProject = projectId ? getProject(data, projectId) : null;
  const linkedChapter = (() => {
    const project = projectId ? routeProject : getProject(data, data.current.draft.linkedProjectId);
    const draft = data.current.draft;
    if (!project || draft.linkedProjectId !== project.id || !draft.linkedChapterId) return null;
    return project.chapters.find((chapter) => chapter.id === draft.linkedChapterId) || null;
  })();

  useEffect(() => {
    if (projectId || !ready || entryParamAppliedRef.current) return;
    entryParamAppliedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedExample = findResearchExample(params.get('example'));
    const requestedTask = params.get('task') as TaskType | null;

    if (requestedExample) {
      const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
      if (hasCurrentWork) {
        const timer = window.setTimeout(() => setPendingEntryExample(requestedExample), 0);
        return () => window.clearTimeout(timer);
      }
      const nextData = loadResearchExampleWorkspace(data, requestedExample);
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

  useEffect(() => () => {
    mountedRef.current = false;
    analysisRunRef.current?.cancel();
    analysisRunRef.current = null;
  }, []);

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
    const result = saveWorkspaceBackToProject(data, projectId);
    if (result.data !== data) {
      replaceData(result.data);
      saveNow(result.data);
    }
    setProjectMessage(result.message);
  }

  async function analyze() {
    if (analysisRunRef.current) return;
    setPageError('');

    const run = createReviewAnalysisRun(data, {
      onStage: (stage) => {
        if (mountedRef.current) setAnalysisStage(stage);
      },
    });
    analysisRunRef.current = run;
    replaceData(run.startedData);

    const outcome = await run.promise;
    if (!mountedRef.current || analysisRunRef.current !== run) return;

    analysisRunRef.current = null;
    setAnalysisStage(null);
    replaceData(outcome.data);
    saveNow(outcome.data);
    if (!outcome.ok) setPageError(outcome.message);
  }

  function cancelAnalysis() {
    analysisRunRef.current?.cancel();
  }

  function confirmEntryExample() {
    const example = pendingEntryExample;
    if (!example) return;
    const nextData = loadResearchExampleWorkspace(data, example);
    setPendingEntryExample(null);
    replaceData(nextData);
    saveNow(nextData);
    window.history.replaceState(null, '', '/workspace');
  }

  function cancelEntryExample() {
    setPendingEntryExample(null);
    window.history.replaceState(null, '', '/workspace');
  }

  function startNew() {
    setNewTaskConfirmOpen(true);
  }

  function startNewConfirmed() {
    const nextData = startNewTaskWorkspace(data);
    setNewTaskConfirmOpen(false);
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
      <ConfirmDialog
        cancelLabel="保留当前任务"
        confirmLabel="保存并载入示例"
        description="当前正文、分析结果和作者决定会先保存到“最近任务”，然后以公开合成示例创建新的审校任务。取消后当前工作区保持不变。"
        eyebrow="载入公开合成示例"
        onCancel={cancelEntryExample}
        onConfirm={confirmEntryExample}
        open={Boolean(pendingEntryExample)}
        title={`载入“${pendingEntryExample?.projectName || '公开合成示例'}”？`}
      />
      <ConfirmDialog
        cancelLabel="继续当前任务"
        confirmLabel="保存并开始新任务"
        description="当前正文、分析结果和作者决定会先保存到“最近任务”，随后清空当前工作区并开始一份新任务。"
        eyebrow="新建审校任务"
        onCancel={() => setNewTaskConfirmOpen(false)}
        onConfirm={startNewConfirmed}
        open={newTaskConfirmOpen}
        title="开始一份新任务？"
      />
    </main>
  );
}
