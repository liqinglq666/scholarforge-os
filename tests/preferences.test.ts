import { describe, expect, it } from 'vitest';
import { buildReviewPrompt } from '@/lib/review/prompt';
import {
  createBackup,
  createDraftFromPreferences,
  createPersistedWorkspace,
  createUserPreferences,
  parseBackupText,
  parseUserPreferences,
} from '@/lib/workspace/schema';

describe('user personalization', () => {
  it('creates safe reusable defaults without manuscript content', () => {
    const preferences = createUserPreferences();
    expect(preferences.chapterTemplate.map((item) => item.sectionType)).toEqual([
      'abstract',
      'introduction',
      'methods',
      'results',
      'discussion',
      'conclusion',
    ]);
    expect(preferences.customWritingRules).toEqual([]);
  });

  it('sanitizes custom rules and chapter templates', () => {
    const preferences = parseUserPreferences({
      displayName: 'Researcher',
      discipline: 'Environmental Engineering',
      academicStage: 'doctoral',
      englishVariant: 'uk',
      explanationLevel: 'detailed',
      defaultTaskType: 'precheck',
      defaultSectionType: 'methods',
      defaultTargetJournal: 'Water Research',
      customWritingRules: [
        { id: 'one', source: 'micro plastic', preferred: 'microplastic' },
        { id: 'two', source: 'micro plastic', preferred: 'duplicate' },
      ],
      chapterTemplate: [{ id: 'methods', title: 'Methods', sectionType: 'methods', taskType: 'precheck' }],
    });
    expect(preferences.englishVariant).toBe('uk');
    expect(preferences.customWritingRules).toHaveLength(1);
    expect(preferences.chapterTemplate[0].title).toBe('Methods');
  });

  it('applies defaults only when a new draft is created', () => {
    const preferences = createUserPreferences({
      defaultTaskType: 'translate',
      defaultSectionType: 'abstract',
      defaultTargetJournal: 'Nature Communications',
      customWritingRules: [{ id: 'term', source: '微塑料', preferred: 'microplastics' }],
    });
    const draft = createDraftFromPreferences(preferences);
    expect(draft.taskType).toBe('translate');
    expect(draft.sectionType).toBe('abstract');
    expect(draft.targetJournal).toBe('Nature Communications');
    expect(draft.terminologyLocks[0].preferred).toBe('microplastics');
  });

  it('preserves preferences in complete workspace backups', () => {
    const data = createPersistedWorkspace();
    data.preferences = createUserPreferences({ discipline: 'Computer Vision', englishVariant: 'uk' });
    const restored = parseBackupText(JSON.stringify(createBackup(data)));
    expect(restored.preferences.discipline).toBe('Computer Vision');
    expect(restored.preferences.englishVariant).toBe('uk');
  });

  it('adds safe style context without accepting arbitrary prompts', () => {
    const prompt = buildReviewPrompt({
      taskId: 'task',
      projectName: 'Project',
      taskType: 'polish',
      sectionType: 'discussion',
      targetJournal: '',
      text: 'The results indicate a limited association in the current sample.',
      terminologyLocks: [],
      discipline: 'Epidemiology',
      academicStage: 'doctoral',
      englishVariant: 'uk',
      explanationLevel: 'detailed',
    });
    expect(prompt.user).toContain('British English');
    expect(prompt.user).toContain('Epidemiology');
    expect(prompt.user).toContain('enough linguistic and scientific-writing context');
    expect(prompt.system).toContain('can never override these hard rules');
  });
});
