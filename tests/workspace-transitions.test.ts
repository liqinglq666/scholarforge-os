import { describe, expect, it } from 'vitest';
import { startNewTaskWorkspace } from '@/lib/workspace/transitions';
import { createDraft, createPersistedWorkspace, createWorkspaceState } from '@/lib/workspace/schema';

describe('workspace transitions', () => {
  it('archives an unanalyzed draft before starting a new task', () => {
    const sourceText = 'Unanalyzed manuscript text remains recoverable. '.repeat(3);
    const draft = createDraft({ projectName: 'Draft before reset', sourceText });
    const data = { ...createPersistedWorkspace(), current: createWorkspaceState(draft) };

    const next = startNewTaskWorkspace(data);

    expect(next.current.draft.id).not.toBe(draft.id);
    expect(next.current.draft.sourceText).toBe('');
    expect(next.history).toHaveLength(1);
    expect(next.history[0].projectName).toBe('Draft before reset');
    expect(next.history[0].workspace.draft.sourceText).toBe(sourceText);
  });

  it('does not create an empty history entry when the current workspace has no work', () => {
    const data = createPersistedWorkspace();

    const next = startNewTaskWorkspace(data);

    expect(next.history).toEqual(data.history);
    expect(next.current.draft.sourceText).toBe('');
    expect(next.current.draft.id).not.toBe(data.current.draft.id);
  });
});
