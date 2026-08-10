import { MAX_HISTORY_ENTRIES } from '@/lib/config';
import type { PersistedWorkspace } from '@/lib/types';
import {
  createDraftFromPreferences,
  createHistoryEntry,
  createWorkspaceState,
} from '@/lib/workspace/schema';

export function startNewTaskWorkspace(data: PersistedWorkspace): PersistedWorkspace {
  const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
  const entry = hasCurrentWork ? createHistoryEntry(data.current) : null;
  const history = entry
    ? [entry, ...data.history.filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES)
    : data.history;

  return {
    ...data,
    current: createWorkspaceState(createDraftFromPreferences(data.preferences)),
    history,
    updatedAt: new Date().toISOString(),
  };
}
