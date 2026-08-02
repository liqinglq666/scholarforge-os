import type { UserPreferences } from '@/lib/types';
import { createManuscriptChapter, createManuscriptProject } from '@/lib/workspace/schema';

export function createProjectFromPreferences(preferences: UserPreferences, name = '我的论文项目') {
  const chapters = preferences.chapterTemplate.map((item) => createManuscriptChapter({
    title: item.title,
    sectionType: item.sectionType,
  }));
  return createManuscriptProject({
    name,
    targetJournal: preferences.defaultTargetJournal,
    terminologyLocks: preferences.customWritingRules.map((item) => ({ ...item, id: crypto.randomUUID() })).slice(0, 20),
    chapters,
  });
}
