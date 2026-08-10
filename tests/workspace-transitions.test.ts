import { describe, expect, it } from 'vitest';
import { getPrimaryResearchExample } from '@/lib/examples';
import { loadResearchExampleWorkspace, startNewTaskWorkspace } from '@/lib/workspace/transitions';
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

  it('archives current work before loading a public research example', () => {
    const example = getPrimaryResearchExample('precheck');
    if (!example) throw new Error('Missing precheck example');
    const sourceText = 'Current manuscript content must be recoverable before the entry example loads. '.repeat(2);
    const currentDraft = createDraft({ projectName: 'Current draft', sourceText });
    const data = { ...createPersistedWorkspace(), current: createWorkspaceState(currentDraft) };

    const next = loadResearchExampleWorkspace(data, example);

    expect(next.history).toHaveLength(1);
    expect(next.history[0].workspace.draft.sourceText).toBe(sourceText);
    expect(next.current.draft.id).not.toBe(currentDraft.id);
    expect(next.current.draft.projectName).toBe(example.projectName);
    expect(next.current.draft.taskType).toBe(example.taskType);
    expect(next.current.draft.sectionType).toBe(example.sectionType);
    expect(next.current.draft.targetJournal).toBe(example.targetJournal);
    expect(next.current.draft.sourceText).toBe(example.sourceText);
    expect(next.current.draft.terminologyLocks).toEqual(example.terminologyLocks);
    expect(next.current.draft.terminologyLocks).not.toBe(example.terminologyLocks);
  });

  it('loads an entry example without creating history when the workspace is empty', () => {
    const example = getPrimaryResearchExample('translate');
    if (!example) throw new Error('Missing translate example');
    const data = createPersistedWorkspace();

    const next = loadResearchExampleWorkspace(data, example);

    expect(next.history).toEqual(data.history);
    expect(next.current.draft.sourceText).toBe(example.sourceText);
    expect(next.current.draft.taskType).toBe('translate');
  });
});
