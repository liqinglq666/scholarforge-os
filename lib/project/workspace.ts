import { MAX_PROJECTS, TASK_LABELS } from '@/lib/config';
import { compareRevisionTexts } from '@/lib/project/revisions';
import type { ManuscriptProject, PersistedWorkspace } from '@/lib/types';
import { createRevisionComparison } from '@/lib/workspace/schema';

export function getProject(data: PersistedWorkspace, projectId?: string | null) {
  const requestedId = projectId || data.activeProjectId;
  return data.projects.find((project) => project.id === requestedId) || null;
}

export function setActiveProject(data: PersistedWorkspace, projectId: string): PersistedWorkspace {
  if (!data.projects.some((project) => project.id === projectId)) return data;
  return { ...data, activeProjectId: projectId, updatedAt: new Date().toISOString() };
}

export function upsertProject(data: PersistedWorkspace, project: ManuscriptProject): PersistedWorkspace {
  const exists = data.projects.some((item) => item.id === project.id);
  if (!exists && data.projects.length >= MAX_PROJECTS) return data;
  const projects = exists
    ? data.projects.map((item) => item.id === project.id ? project : item)
    : [project, ...data.projects];
  return {
    ...data,
    projects,
    activeProjectId: project.id,
    updatedAt: new Date().toISOString(),
  };
}

export type ProjectSaveBackStatus = 'missing-link' | 'missing-chapter' | 'unchanged' | 'saved-review' | 'saved-revision';

export interface ProjectSaveBackResult {
  data: PersistedWorkspace;
  status: ProjectSaveBackStatus;
  message: string;
}

export function saveWorkspaceBackToProject(data: PersistedWorkspace, routeProjectId?: string): ProjectSaveBackResult {
  const draft = data.current.draft;
  const project = getProject(data, draft.linkedProjectId || routeProjectId);
  const chapterId = draft.linkedChapterId;

  if (!project || draft.linkedProjectId !== project.id || !chapterId) {
    return { data, status: 'missing-link', message: '当前工作台没有可回写的项目章节。' };
  }

  const chapter = project.chapters.find((item) => item.id === chapterId);
  if (!chapter) {
    return { data, status: 'missing-chapter', message: '关联章节已不存在，无法回写。当前工作台内容仍然保留。' };
  }

  const now = new Date().toISOString();
  const hasReviewResult = Boolean(data.current.currentResult);
  const text = hasReviewResult ? data.current.workingText : draft.sourceText;
  const changes = chapter.text === text
    ? []
    : compareRevisionTexts(chapter.text, text).map((change) => ({
        ...change,
        source: hasReviewResult ? 'ai' as const : 'author' as const,
        reason: hasReviewResult
          ? `作者在“${TASK_LABELS[draft.taskType]}”流程中确认后保存。`
          : '作者从项目审校页面保存了新文本。',
      }));

  if (!changes.length && !hasReviewResult) {
    return { data, status: 'unchanged', message: `“${chapter.title}”没有文本变化，项目正文保持不变。` };
  }

  const comparison = changes.length ? createRevisionComparison({
    title: `${chapter.title} · ${TASK_LABELS[draft.taskType]} · ${new Date(now).toLocaleDateString('zh-CN')}`,
    chapterId,
    baseLabel: '保存前',
    revisedLabel: '作者确认后',
    baseText: chapter.text,
    revisedText: text,
    changes,
    createdAt: now,
    updatedAt: now,
  }) : null;

  const nextProject: ManuscriptProject = {
    ...project,
    activeChapterId: chapterId,
    chapters: project.chapters.map((item) => item.id === chapterId
      ? {
          ...item,
          title: item.title || draft.projectName,
          sectionType: draft.sectionType,
          text,
          updatedAt: now,
          lastReviewedAt: hasReviewResult ? now : item.lastReviewedAt,
        }
      : item),
    revisionComparisons: comparison
      ? [comparison, ...project.revisionComparisons].slice(0, 20)
      : project.revisionComparisons,
    updatedAt: now,
  };

  return {
    data: upsertProject(data, nextProject),
    status: comparison ? 'saved-revision' : 'saved-review',
    message: comparison
      ? `已保存回“${chapter.title}”，并自动生成一条版本记录。`
      : `“${chapter.title}”没有文本变化，已更新审校时间。`,
  };
}

export function removeProject(data: PersistedWorkspace, projectId: string): PersistedWorkspace {
  const projects = data.projects.filter((project) => project.id !== projectId);
  const activeProjectId = data.activeProjectId === projectId ? projects[0]?.id : data.activeProjectId;
  const currentLinkedToRemoved = data.current.draft.linkedProjectId === projectId;
  return {
    ...data,
    projects,
    ...(activeProjectId ? { activeProjectId } : { activeProjectId: undefined }),
    current: currentLinkedToRemoved
      ? {
          ...data.current,
          draft: {
            ...data.current.draft,
            linkedProjectId: undefined,
            linkedChapterId: undefined,
            updatedAt: new Date().toISOString(),
          },
        }
      : data.current,
    updatedAt: new Date().toISOString(),
  };
}
