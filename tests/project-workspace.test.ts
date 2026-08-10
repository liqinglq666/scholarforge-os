import { describe, expect, it } from 'vitest';
import { saveWorkspaceBackToProject } from '@/lib/project/workspace';
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

describe('project workspace save-back', () => {
  it('writes edited workspace text to the linked chapter and creates an author revision', () => {
    const chapter = createManuscriptChapter({ title: 'Methods', sectionType: 'methods', text: 'Original methods sentence. '.repeat(4) });
    const project = createManuscriptProject({ name: 'Save-back project', chapters: [chapter], activeChapterId: chapter.id });
    const revisedText = 'Revised methods sentence. '.repeat(4);
    const draft = createDraft({
      projectName: project.name,
      sectionType: 'methods',
      sourceText: revisedText,
      linkedProjectId: project.id,
      linkedChapterId: chapter.id,
    });
    const data = {
      ...createPersistedWorkspace(),
      projects: [project],
      activeProjectId: project.id,
      current: createWorkspaceState(draft),
    };

    const result = saveWorkspaceBackToProject(data, project.id);
    const savedProject = result.data.projects[0];

    expect(result.status).toBe('saved-revision');
    expect(savedProject.chapters[0].text).toBe(revisedText);
    expect(savedProject.activeChapterId).toBe(chapter.id);
    expect(savedProject.revisionComparisons).toHaveLength(1);
    expect(savedProject.revisionComparisons[0].changes.every((change) => change.source === 'author')).toBe(true);
  });

  it('does not mutate project data or create a revision when author text is unchanged', () => {
    const text = 'Unchanged project sentence. '.repeat(4);
    const chapter = createManuscriptChapter({ title: 'Results', sectionType: 'results', text });
    const project = createManuscriptProject({ name: 'Unchanged project', chapters: [chapter], activeChapterId: chapter.id });
    const draft = createDraft({
      projectName: project.name,
      sectionType: 'results',
      sourceText: text,
      linkedProjectId: project.id,
      linkedChapterId: chapter.id,
    });
    const data = { ...createPersistedWorkspace(), projects: [project], activeProjectId: project.id, current: createWorkspaceState(draft) };

    const result = saveWorkspaceBackToProject(data, project.id);

    expect(result.status).toBe('unchanged');
    expect(result.data).toBe(data);
    expect(result.data.projects[0].revisionComparisons).toHaveLength(0);
  });

  it('keeps workspace and project data untouched when the linked chapter no longer exists', () => {
    const project = createManuscriptProject({ name: 'Deleted chapter project' });
    const draft = createDraft({
      projectName: project.name,
      sourceText: 'Workspace text remains available. '.repeat(3),
      linkedProjectId: project.id,
      linkedChapterId: 'missing-chapter',
    });
    const data = { ...createPersistedWorkspace(), projects: [project], activeProjectId: project.id, current: createWorkspaceState(draft) };

    const result = saveWorkspaceBackToProject(data, project.id);

    expect(result.status).toBe('missing-chapter');
    expect(result.data).toBe(data);
    expect(result.message).toContain('工作台内容仍然保留');
  });
});
