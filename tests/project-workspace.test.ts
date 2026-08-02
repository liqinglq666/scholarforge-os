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

describe('manuscript project persistence', () => {
  it('preserves chapters, terminology locks, and active chapter', () => {
    const chapter = createManuscriptChapter({ title: 'Methods', sectionType: 'methods', text: 'A'.repeat(80) });
    const project = createManuscriptProject({
      name: 'Thesis project',
      targetJournal: 'Research Journal',
      chapters: [chapter],
      activeChapterId: chapter.id,
      terminologyLocks: [{ id: 'term-1', source: 'neural net', preferred: 'neural network (NN)' }],
    });
    const parsed = parsePersistedWorkspace({ ...createPersistedWorkspace(), project });
    expect(parsed.project?.name).toBe('Thesis project');
    expect(parsed.project?.chapters[0].sectionType).toBe('methods');
    expect(parsed.project?.activeChapterId).toBe(chapter.id);
    expect(parsed.project?.terminologyLocks[0].preferred).toBe('neural network (NN)');
  });

  it('includes the project in workspace backups', () => {
    const chapter = createManuscriptChapter({ title: 'Results', text: 'The final sample included n = 118 participants.' });
    const project = createManuscriptProject({ name: 'Backup project', chapters: [chapter] });
    const data = { ...createPersistedWorkspace(), project };
    const backup = createBackup(data);
    const restored = parseBackupText(JSON.stringify(backup));
    expect(restored.project?.name).toBe('Backup project');
    expect(restored.project?.chapters[0].text).toContain('n = 118');
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
      project,
      current: createWorkspaceState(draft),
    });
    expect(parsed.current.draft.linkedProjectId).toBe(project.id);
    expect(parsed.current.draft.linkedChapterId).toBe(chapter.id);
  });
});
