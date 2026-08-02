import { describe, expect, it } from 'vitest';
import {
  createBackup,
  createDraft,
  createManuscriptChapter,
  createManuscriptProject,
  createPersistedWorkspace,
  createWorkspaceState,
  parseBackupText,
  parsePersistedWorkspace,
} from '@/lib/workspace/schema';

describe('multi-project persistence', () => {
  it('migrates a v2 single project into the v3 portfolio', () => {
    const chapter = createManuscriptChapter({ title: 'Methods', sectionType: 'methods', text: 'A'.repeat(80) });
    const project = createManuscriptProject({
      name: 'Thesis project',
      targetJournal: 'Research Journal',
      chapters: [chapter],
      activeChapterId: chapter.id,
      terminologyLocks: [{ id: 'term-1', source: 'neural net', preferred: 'neural network (NN)' }],
    });
    const parsed = parsePersistedWorkspace({
      version: 2,
      current: createPersistedWorkspace().current,
      history: [],
      project,
      preferences: createPersistedWorkspace().preferences,
      updatedAt: new Date().toISOString(),
    });
    expect(parsed.version).toBe(3);
    expect(parsed.projects[0].name).toBe('Thesis project');
    expect(parsed.activeProjectId).toBe(project.id);
    expect(parsed.projects[0].chapters[0].sectionType).toBe('methods');
  });

  it('imports a legacy v2 backup without losing its single project', () => {
    const project = createManuscriptProject({ name: 'Legacy backup project' });
    const defaults = createPersistedWorkspace();
    const restored = parseBackupText(JSON.stringify({
      format: 'scholarforge-workspace',
      version: 2,
      exportedAt: new Date().toISOString(),
      current: defaults.current,
      history: [],
      project,
      preferences: defaults.preferences,
    }));

    expect(restored.version).toBe(3);
    expect(restored.projects).toHaveLength(1);
    expect(restored.projects[0].name).toBe('Legacy backup project');
  });

  it('includes all projects in workspace backups', () => {
    const first = createManuscriptProject({ name: 'First project' });
    const second = createManuscriptProject({ name: 'Backup project', chapters: [createManuscriptChapter({ title: 'Results', text: 'The final sample included n = 118 participants.' })] });
    const data = { ...createPersistedWorkspace(), projects: [first, second], activeProjectId: second.id };
    const restored = parseBackupText(JSON.stringify(createBackup(data)));
    expect(restored.projects).toHaveLength(2);
    expect(restored.activeProjectId).toBe(second.id);
    expect(restored.projects[1].chapters[0].text).toContain('n = 118');
  });

  it('preserves links from the review workspace to a project chapter', () => {
    const project = createManuscriptProject({ name: 'Linked project' });
    const chapter = project.chapters[0];
    const draft = createDraft({
      projectName: project.name,
      sourceText: 'B'.repeat(80),
      linkedProjectId: project.id,
      linkedChapterId: chapter.id,
    });
    const parsed = parsePersistedWorkspace({
      ...createPersistedWorkspace(),
      projects: [project],
      activeProjectId: project.id,
      current: createWorkspaceState(draft),
    });
    expect(parsed.current.draft.linkedProjectId).toBe(project.id);
    expect(parsed.current.draft.linkedChapterId).toBe(chapter.id);
  });
});
