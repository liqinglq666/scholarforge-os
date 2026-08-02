import { describe, expect, it } from 'vitest';
import { MAX_PROJECTS } from '@/lib/config';
import { createProjectFromPreferences } from '@/lib/project/create';
import { getProject, removeProject, setActiveProject, upsertProject } from '@/lib/project/workspace';
import { createDraft, createPersistedWorkspace, createUserPreferences, createWorkspaceState } from '@/lib/workspace/schema';

describe('project portfolio helpers', () => {
  it('creates multiple projects and keeps one explicit active project', () => {
    const preferences = createUserPreferences({
      chapterTemplate: [{ id: 'abstract', title: 'Structured Abstract', sectionType: 'abstract' }],
    });
    const first = createProjectFromPreferences(preferences, 'First paper');
    const second = createProjectFromPreferences(preferences, 'Second paper');
    const withFirst = upsertProject(createPersistedWorkspace(), first);
    const withSecond = upsertProject(withFirst, second);

    expect(withSecond.projects.map((project) => project.name)).toEqual(['Second paper', 'First paper']);
    expect(withSecond.activeProjectId).toBe(second.id);
    expect(getProject(setActiveProject(withSecond, first.id))?.name).toBe('First paper');
    expect(first.chapters[0]).not.toHaveProperty('taskType');
  });

  it('does not silently drop an existing project when the local limit is reached', () => {
    const preferences = createUserPreferences();
    const projects = Array.from({ length: MAX_PROJECTS }, (_, index) => createProjectFromPreferences(preferences, `Paper ${index + 1}`));
    const full = { ...createPersistedWorkspace(), projects, activeProjectId: projects[0].id };
    const extra = createProjectFromPreferences(preferences, 'Extra paper');
    const result = upsertProject(full, extra);

    expect(result.projects).toHaveLength(MAX_PROJECTS);
    expect(result.projects.some((project) => project.id === extra.id)).toBe(false);
    expect(result.projects.map((project) => project.id)).toEqual(projects.map((project) => project.id));
  });

  it('removes only the selected project and clears stale workspace links', () => {
    const preferences = createUserPreferences();
    const first = createProjectFromPreferences(preferences, 'First paper');
    const second = createProjectFromPreferences(preferences, 'Second paper');
    const data = {
      ...upsertProject(upsertProject(createPersistedWorkspace(), first), second),
      current: createWorkspaceState(createDraft({
        linkedProjectId: second.id,
        linkedChapterId: second.chapters[0].id,
        sourceText: 'A linked manuscript passage that is long enough for review.',
      })),
    };

    const removed = removeProject(data, second.id);
    expect(removed.projects).toHaveLength(1);
    expect(removed.projects[0].id).toBe(first.id);
    expect(removed.activeProjectId).toBe(first.id);
    expect(removed.current.draft.linkedProjectId).toBeUndefined();
    expect(removed.current.draft.sourceText).toContain('linked manuscript passage');
  });
});
