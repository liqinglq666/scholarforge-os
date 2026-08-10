import { MAX_HISTORY_ENTRIES } from '@/lib/config';
import type { ResearchExample } from '@/lib/examples';
import type { PersistedWorkspace } from '@/lib/types';
import {
  createDraft,
  createDraftFromPreferences,
  createHistoryEntry,
  createWorkspaceState,
} from '@/lib/workspace/schema';

function archiveCurrentWork(data: PersistedWorkspace) {
  const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
  const entry = hasCurrentWork ? createHistoryEntry(data.current) : null;
  return entry
    ? [entry, ...data.history.filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES)
    : data.history;
}

export function startNewTaskWorkspace(data: PersistedWorkspace): PersistedWorkspace {
  return {
    ...data,
    current: createWorkspaceState(createDraftFromPreferences(data.preferences)),
    history: archiveCurrentWork(data),
    updatedAt: new Date().toISOString(),
  };
}

export function loadResearchExampleWorkspace(data: PersistedWorkspace, example: ResearchExample): PersistedWorkspace {
  const draft = createDraft({
    projectName: example.projectName,
    taskType: example.taskType,
    sectionType: example.sectionType,
    targetJournal: example.targetJournal,
    sourceText: example.sourceText,
    terminologyLocks: example.terminologyLocks.map((term) => ({ ...term })),
  });

  return {
    ...data,
    current: createWorkspaceState(draft),
    history: archiveCurrentWork(data),
    updatedAt: new Date().toISOString(),
  };
}
