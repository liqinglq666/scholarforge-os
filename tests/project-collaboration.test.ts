import { describe, expect, it } from 'vitest';
import {
  createBackup,
  createManuscriptChapter,
  createManuscriptProject,
  createPersistedWorkspace,
  createRevisionComparison,
  createSupervisorFeedbackItem,
  parseBackupText,
  parsePersistedWorkspace,
} from '@/lib/workspace/schema';

describe('project collaboration records', () => {
  it('preserves supervisor feedback and linked revision changes', () => {
    const chapter = createManuscriptChapter({ title: 'Discussion', text: 'Original discussion text.' });
    const feedback = createSupervisorFeedbackItem({
      id: 'feedback-1',
      comment: 'Explain the mechanism instead of repeating the results.',
      chapterId: chapter.id,
      status: 'completed',
      authorResponse: 'Added a mechanism paragraph in Discussion.',
      completedAt: new Date().toISOString(),
    });
    const comparison = createRevisionComparison({
      title: 'Discussion revision',
      chapterId: chapter.id,
      baseText: 'The result increased.',
      revisedText: 'The increase may be explained by improved transport.',
      changes: [{
        id: 'change-1',
        kind: 'modified',
        before: 'The result increased.',
        after: 'The increase may be explained by improved transport.',
        source: 'supervisor',
        reason: 'Responds to the request for a mechanism explanation.',
        feedbackId: feedback.id,
      }],
    });
    const project = createManuscriptProject({
      name: 'Thesis',
      chapters: [chapter],
      supervisorFeedback: [feedback],
      revisionComparisons: [comparison],
    });
    const restored = parseBackupText(JSON.stringify(createBackup({ ...createPersistedWorkspace(), projects: [project], activeProjectId: project.id })));
    expect(restored.projects[0].supervisorFeedback[0].status).toBe('completed');
    expect(restored.projects[0].revisionComparisons[0].changes[0].feedbackId).toBe('feedback-1');
  });

  it('drops invalid chapter and feedback references without dropping the record', () => {
    const parsed = parsePersistedWorkspace({
      ...createPersistedWorkspace(),
      projects: [{
        id: 'project-1',
        name: 'Project',
        chapters: [{ id: 'chapter-1', title: 'Methods', sectionType: 'methods', taskType: 'precheck', text: 'A'.repeat(80) }],
        supervisorFeedback: [{ id: 'feedback-1', comment: 'Check this.', chapterId: 'missing', status: 'pending', priority: 'normal', authorResponse: '' }],
        revisionComparisons: [{
          id: 'comparison-1',
          title: 'Comparison',
          chapterId: 'missing',
          baseLabel: 'Old',
          revisedLabel: 'New',
          baseText: 'Old sentence.',
          revisedText: 'New sentence.',
          changes: [{ id: 'change-1', kind: 'modified', before: 'Old sentence.', after: 'New sentence.', source: 'supervisor', reason: '', feedbackId: 'missing-feedback' }],
        }],
      }],
      activeProjectId: 'project-1',
    });
    expect(parsed.projects[0].supervisorFeedback[0].chapterId).toBeUndefined();
    expect(parsed.projects[0].revisionComparisons[0].chapterId).toBeUndefined();
    expect(parsed.projects[0].revisionComparisons[0].changes[0].feedbackId).toBeUndefined();
  });
});
