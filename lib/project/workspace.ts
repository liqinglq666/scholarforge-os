import { MAX_PROJECTS } from '@/lib/config';
import type { ManuscriptProject, PersistedWorkspace } from '@/lib/types';

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
